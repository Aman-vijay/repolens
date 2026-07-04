from fastapi import APIRouter, Depends, Request
from sqlalchemy.ext.asyncio import AsyncSession

from app.deps import get_db_session
from app.services import webhook_service

router = APIRouter(tags=["webhooks"])


@router.post("/webhooks/clerk")
async def clerk_webhook(
    request: Request,
    db: AsyncSession = Depends(get_db_session),
):
    body = await request.body()
    headers = {
        "svix-id": request.headers.get("svix-id", ""),
        "svix-timestamp": request.headers.get("svix-timestamp", ""),
        "svix-signature": request.headers.get("svix-signature", ""),
    }

    payload = webhook_service.verify_webhook(body, headers)

    if payload["type"] == "user.created":
        await webhook_service.handle_user_created(db, payload["data"])

    return {"status": "ok"}