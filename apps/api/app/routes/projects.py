import uuid

from fastapi import APIRouter, Depends, Request
from sqlalchemy.ext.asyncio import AsyncSession

from app.deps import get_current_user, get_db_session
from app.middleware.rate_limit import limiter
from app.schemas.project import ProjectCreate, ProjectOut, RATE_LIMIT
from app.services import project_service
from repolens_db import User

router = APIRouter(tags=["projects"])


@router.get("/projects", response_model=list[ProjectOut])
@limiter.limit(RATE_LIMIT)
async def list_projects(
    request: Request,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session),
):
    return await project_service.list_projects(db, current_user)


@router.post("/projects", response_model=ProjectOut, status_code=201)
@limiter.limit(RATE_LIMIT)
async def create_project(
    request: Request,
    body: ProjectCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session),
):
    return await project_service.create_project(db, current_user, body)


@router.delete("/projects/{project_id}", status_code=204)
@limiter.limit(RATE_LIMIT)
async def delete_project(
    request: Request,
    project_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session),
):
    await project_service.delete_project(db, project_id, current_user)
    return None