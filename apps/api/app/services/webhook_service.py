"""Webhook service — business logic for Clerk webhook handling."""
from fastapi.responses import JSONResponse
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import AsyncSession
from svix import Webhook, WebhookVerificationError

from fastapi import HTTPException, status

from app.settings import get_settings
from repolens_db import User


def verify_webhook(body: bytes, headers: dict) -> dict:
    settings = get_settings()
    if not settings.clerk_webhook_secret:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="CLERK_WEBHOOK_SECRET not configured",
        )

    wh = Webhook(settings.clerk_webhook_secret)
    try:
        return wh.verify(body, headers)
    except WebhookVerificationError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid webhook signature",
        )


async def handle_user_created(db: AsyncSession, data: dict) -> None:
    settings = get_settings()
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