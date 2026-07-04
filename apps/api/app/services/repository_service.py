"""Repository service — business logic for repository attachment and retrieval."""
import uuid

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.schemas import RepositoryCreate
from app.services.queue import enqueue_clone
from repolens_db import Project, Repository, User


def validate_git_url(url: str) -> str:
    if not url.startswith("https://"):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Only HTTPS git URLs are allowed",
        )
    if url.startswith("https://github.com/"):
        return url.replace(".git", "") + ".git"
    return url


async def attach_repository(
    db: AsyncSession,
    project: Project,
    data: RepositoryCreate,
) -> Repository:
    existing = await db.execute(
        select(Repository).where(Repository.project_id == project.id)
    )
    if existing.scalar_one_or_none() is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Repository already attached to this project",
        )

    url = validate_git_url(data.url)
    repo = Repository(project_id=project.id, url=url, status="pending", progress=0)
    db.add(repo)
    await db.commit()
    await db.refresh(repo)

    await enqueue_clone(repository_id=str(repo.id))
    return repo


async def get_repository(
    db: AsyncSession,
    project: Project,
) -> Repository:
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