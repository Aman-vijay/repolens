"""Project service — business logic for project CRUD operations."""
import uuid

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.schemas import ProjectCreate
from repolens_db import Project, Repository, User


async def list_projects(db: AsyncSession, user: User) -> list[Project]:
    result = await db.execute(
        select(Project)
        .where(Project.user_id == user.id)
        .order_by(Project.created_at.desc())
    )
    return list(result.scalars().all())


async def create_project(db: AsyncSession, user: User, data: ProjectCreate) -> Project:
    project = Project(
        user_id=user.id,
        name=data.name,
        description=data.description,
    )
    db.add(project)
    await db.commit()
    await db.refresh(project)
    return project


async def get_owned_project_or_404(
    db: AsyncSession,
    project_id: uuid.UUID,
    user: User,
    with_repository: bool = False,
) -> Project:
    stmt = select(Project).where(
        Project.id == project_id,
        Project.user_id == user.id,
    )
    if with_repository:
        stmt = stmt.options(selectinload(Project.repository))
    result = await db.execute(stmt)
    project = result.scalar_one_or_none()
    if project is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Project not found",
        )
    return project


async def get_project_detail(
    db: AsyncSession,
    project_id: uuid.UUID,
    user: User,
) -> Project:
    return await get_owned_project_or_404(
        db, project_id, user, with_repository=True
    )


async def delete_project(
    db: AsyncSession,
    project_id: uuid.UUID,
    user: User,
) -> None:
    project = await get_owned_project_or_404(db, project_id, user, with_repository=True)
    await db.delete(project)
    await db.commit()