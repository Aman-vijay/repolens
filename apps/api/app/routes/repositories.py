import uuid

from fastapi import APIRouter, Depends, Request
from sqlalchemy.ext.asyncio import AsyncSession

from app.deps import get_current_user, get_db_session
from app.middleware.rate_limit import limiter
from app.schemas.project import ProjectDetailOut
from app.schemas.repository import (
    RATE_LIMIT_ATTACH,
    RATE_LIMIT_POLL,
    RepositoryCreate,
    RepositoryOut,
)
from app.services import project_service, repository_service
from repolens_db import User

router = APIRouter(tags=["repositories"])


@router.post(
    "/projects/{project_id}/repository",
    response_model=RepositoryOut,
    status_code=202,
)
@limiter.limit(RATE_LIMIT_ATTACH)
async def attach_repository(
    request: Request,
    project_id: uuid.UUID,
    body: RepositoryCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session),
):
    project = await project_service.get_owned_project_or_404(db, project_id, current_user)
    return await repository_service.attach_repository(db, project, body)


@router.get(
    "/projects/{project_id}/repository",
    response_model=RepositoryOut,
)
@limiter.limit(RATE_LIMIT_POLL)
async def get_repository(
    request: Request,
    project_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session),
):
    project = await project_service.get_owned_project_or_404(db, project_id, current_user)
    return await repository_service.get_repository(db, project)


@router.get(
    "/projects/{project_id}",
    response_model=ProjectDetailOut,
)
@limiter.limit(RATE_LIMIT_POLL)
async def get_project_detail(
    request: Request,
    project_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session),
):
    return await project_service.get_project_detail(db, project_id, current_user)