from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.responses import JSONResponse
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import AsyncSession
from svix import Webhook, WebhookVerificationError

from app.deps import get_db_session
from app.settings import get_settings
from repolens_db import User

router = APIRouter(tags=["webhooks"])


@router.post("/webhooks/clerk")
async def clerk_webhook(
    request: Request,
    db: AsyncSession = Depends(get_db_session),
):
    settings = get_settings()
    if not settings.clerk_webhook_secret:
        return JSONResponse(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            content={"detail": "CLERK_WEBHOOK_SECRET not configured"},
        )

    body = await request.body()
    headers = {
        "svix-id": request.headers.get("svix-id", ""),
        "svix-timestamp": request.headers.get("svix-timestamp", ""),
        "svix-signature": request.headers.get("svix-signature", ""),
    }

    wh = Webhook(settings.clerk_webhook_secret)
    try:
        payload = wh.verify(body, headers)
    except WebhookVerificationError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid webhook signature",
        )

    if payload["type"] == "user.created":
        data = payload["data"]
        clerk_user_id = data["id"]
        email = ""
        if data.get("email_addresses"):
            email = data["email_addresses"][0]["email_address"]

        is_superuser = clerk_user_id == settings.superadmin_clerk_user_id

        stmt = (
            pg_insert(User)
            .values(
                clerk_user_id=clerk_user_id,
                email=email,
                is_superuser=is_superuser,
            )
            .on_conflict_do_nothing(index_elements=["clerk_user_id"])
        )
        await db.execute(stmt)
        await db.commit()

    return {"status": "ok"}
