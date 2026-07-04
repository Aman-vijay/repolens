"""Authentication dependencies for FastAPI.

Optimizations:
- Module-level Clerk client singleton (not created per request)
- SELECT-first strategy: skip the upsert write if the user already exists
  (the common case after the first request)
- Cache user in request state to avoid duplicate lookups per request
"""
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


_clerk_client: Clerk | None = None


def _get_clerk_client() -> Clerk:
    """Return a module-level Clerk client singleton."""
    global _clerk_client
    if _clerk_client is None:
        settings = get_settings()
        _clerk_client = Clerk(bearer_auth=settings.clerk_secret_key)
    return _clerk_client


async def get_db_session() -> AsyncSession:
    async with get_async_session_factory()() as session:
        yield session


async def get_current_user(
    request: Request,
    db: AsyncSession = Depends(get_db_session),
) -> User:
    # Cache user on the request to avoid duplicate lookups within one request
    cached = getattr(request.state, "_current_user", None)
    if cached is not None:
        return cached

    settings = get_settings()
    clerk = _get_clerk_client()

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

    # --- Fast path: SELECT the user first (avoids a write on every read request) ---
    result = await db.execute(
        select(User).where(User.clerk_user_id == clerk_user_id)
    )
    user = result.scalar_one_or_none()

    if user is not None:
        # User exists — no need to upsert. Cache and return immediately.
        request.state._current_user = user
        return user

    # --- Slow path: first time we see this user — upsert ---
    email = request_state.payload.get("email", "")
    if not email:
        try:
            clerk_user = await asyncio.to_thread(
                clerk.users.get, user_id=clerk_user_id
            )
            if clerk_user.email_addresses:
                email = clerk_user.email_addresses[0].email_address
        except Exception:
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
        .on_conflict_do_nothing(index_elements=["clerk_user_id"])
    )
    await db.execute(stmt)
    await db.commit()

    # Now SELECT the user (handles the race where conflict happened)
    result = await db.execute(
        select(User).where(User.clerk_user_id == clerk_user_id)
    )
    user = result.scalar_one()
    request.state._current_user = user
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