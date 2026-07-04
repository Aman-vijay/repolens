from fastapi import APIRouter, Depends, Query, Request
from sqlalchemy.ext.asyncio import AsyncSession

from app.deps import get_current_superuser, get_db_session
from app.middleware.rate_limit import limiter
from app.schemas.admin import (
    AdminProjectOut,
    AdminStatsOut,
    AdminUserOut,
    RATE_LIMIT,
)
from app.services import admin_service
from repolens_db import User

router = APIRouter(prefix="/admin", tags=["admin"])


@router.get("/stats", response_model=AdminStatsOut)
@limiter.limit(RATE_LIMIT)
async def admin_stats(
    request: Request,
    _user: User = Depends(get_current_superuser),
    db: AsyncSession = Depends(get_db_session),
):
    return await admin_service.get_stats(db)


@router.get("/users", response_model=list[AdminUserOut])
@limiter.limit(RATE_LIMIT)
async def admin_list_users(
    request: Request,
    _user: User = Depends(get_current_superuser),
    db: AsyncSession = Depends(get_db_session),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
):
    return await admin_service.list_users(db, limit, offset)


@router.get("/projects", response_model=list[AdminProjectOut])
@limiter.limit(RATE_LIMIT)
async def admin_list_projects(
    request: Request,
    _user: User = Depends(get_current_superuser),
    db: AsyncSession = Depends(get_db_session),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
):
    return await admin_service.list_projects(db, limit, offset)