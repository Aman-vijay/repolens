import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.deps import get_current_user, get_db_session
from app.schemas import ProjectDetailOut, RepositoryCreate, RepositoryOut
from app.services.queue import enqueue_clone
from repolens_db import Project, Repository, User

router = APIRouter(tags=["repositories"])


def _validate_url(url: str) -> str:
    if not url.startswith("https://"):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Only HTTPS git URLs are allowed",
        )
    if url.startswith("https://github.com/"):
        return url.replace(".git", "") + ".git"
    return url


async def _get_owned_project_or_404(
    project_id: uuid.UUID,
    current_user: User,
    db: AsyncSession,
    with_repository: bool = False,
) -> Project:
    stmt = select(Project).where(
        Project.id == project_id,
        Project.user_id == current_user.id,
    )
    if with_repository:
        stmt = stmt.options(selectinload(Project.repository))
    result = await db.execute(stmt)
    project = result.scalar_one_or_none()
    if project is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")
    return project


@router.post(
    "/projects/{project_id}/repository",
    response_model=RepositoryOut,
    status_code=status.HTTP_202_ACCEPTED,
)
async def attach_repository(
    project_id: uuid.UUID,
    body: RepositoryCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session),
):
    project = await _get_owned_project_or_404(project_id, current_user, db)

    existing = await db.execute(
        select(Repository).where(Repository.project_id == project.id)
    )
    if existing.scalar_one_or_none() is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Repository already attached to this project",
        )

    url = _validate_url(body.url)
    repo = Repository(project_id=project.id, url=url, status="pending", progress=0)
    db.add(repo)
    await db.commit()
    await db.refresh(repo)

    await enqueue_clone(repository_id=str(repo.id))
    return repo


@router.get(
    "/projects/{project_id}/repository",
    response_model=RepositoryOut,
)
async def get_repository(
    project_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session),
):
    project = await _get_owned_project_or_404(project_id, current_user, db)

    result = await db.execute(
        select(Repository).where(Repository.project_id == project.id)
    )
    repo = result.scalar_one_or_none()
    if repo is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No repository attached",
        )
    return repo


@router.get(
    "/projects/{project_id}",
    response_model=ProjectDetailOut,
)
async def get_project_detail(
    project_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session),
):
    project = await _get_owned_project_or_404(
        project_id, current_user, db, with_repository=True
    )
    return project