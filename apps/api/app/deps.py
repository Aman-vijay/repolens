import asyncio

import httpx
from clerk_backend_api import Clerk
from clerk_backend_api.security.types import AuthenticateRequestOptions
from fastapi import Depends, HTTPException, Request, status
from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.settings import get_settings
from repolens_db import User, get_async_session_factory


async def get_db_session() -> AsyncSession:
    async with get_async_session_factory()() as session:
        yield session


async def get_current_user(
    request: Request,
    db: AsyncSession = Depends(get_db_session),
) -> User:
    settings = get_settings()
    clerk = Clerk(bearer_auth=settings.clerk_secret_key)

    auth_header = request.headers.get("Authorization")
    if not auth_header or not auth_header.startswith("Bearer "):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing bearer token",
        )

    httpx_request = httpx.Request(
        method=request.method,
        url=str(request.url),
        headers={"Authorization": auth_header},
    )

    request_state = await asyncio.to_thread(
        clerk.authenticate_request,
        httpx_request,
        AuthenticateRequestOptions(
            authorized_parties=[settings.frontend_url],
        ),
    )

    if not request_state.is_signed_in:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Invalid session: {request_state.reason}",
        )

    clerk_user_id = request_state.payload.get("sub")
    if not clerk_user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="No user ID in token payload",
        )

    email = request_state.payload.get("email", "")
    if not email:
        try:
            clerk_user = await asyncio.to_thread(
                clerk.users.get, user_id=clerk_user_id
            )
            if clerk_user.email_addresses:
                email = clerk_user.email_addresses[0].email_address
        except Exception:
            # Keep auth working even if the secondary Clerk user lookup fails.
            email = ""

    if not email:
        email = f"{clerk_user_id}@placeholder.invalid"

    is_superuser = clerk_user_id == settings.superadmin_clerk_user_id

    stmt = (
        pg_insert(User)
        .values(
            clerk_user_id=clerk_user_id,
            email=email,
            is_superuser=is_superuser,
        )
        .on_conflict_do_update(
            index_elements=["clerk_user_id"],
            set_={
                "email": email,
                "is_superuser": is_superuser,
            },
        )
        .returning(User)
    )
    result = await db.execute(stmt)
    await db.commit()
    user = result.scalar_one_or_none()

    if user is None:
        result = await db.execute(
            select(User).where(User.clerk_user_id == clerk_user_id)
        )
        user = result.scalar_one()

    return user


async def get_current_superuser(
    current_user: User = Depends(get_current_user),
) -> User:
    if not current_user.is_superuser:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Superadmin access required",
        )
    return current_user
