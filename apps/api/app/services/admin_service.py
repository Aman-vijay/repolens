"""Admin service — business logic for admin dashboard queries."""
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.schemas import AdminProjectOut, AdminStatsOut, AdminUserOut
from repolens_db import Project, Repository, User


async def get_stats(db: AsyncSession) -> AdminStatsOut:
    total_users = await db.scalar(select(func.count(User.id)))
    total_projects = await db.scalar(select(func.count(Project.id)))
    total_repos = await db.scalar(select(func.count(Repository.id)))

    status_result = await db.execute(
        select(Repository.status, func.count(Repository.id))
        .group_by(Repository.status)
    )
    repos_by_status = {row[0]: row[1] for row in status_result.fetchall()}

    return AdminStatsOut(
        total_users=total_users or 0,
        total_projects=total_projects or 0,
        total_repos=total_repos or 0,
        repos_by_status=repos_by_status,
    )


async def list_users(
    db: AsyncSession, limit: int = 50, offset: int = 0
) -> list[AdminUserOut]:
    result = await db.execute(
        select(
            User.id,
            User.clerk_user_id,
            User.email,
            User.is_superuser,
            User.created_at,
            func.count(Project.id).label("project_count"),
        )
        .outerjoin(Project, Project.user_id == User.id)
        .group_by(User.id)
        .order_by(User.created_at.desc())
        .limit(limit)
        .offset(offset)
    )
    return [
        AdminUserOut(
            id=row[0],
            clerk_user_id=row[1],
            email=row[2],
            is_superuser=row[3],
            created_at=row[4],
            project_count=row[5],
        )
        for row in result.fetchall()
    ]


async def list_projects(
    db: AsyncSession, limit: int = 50, offset: int = 0
) -> list[AdminProjectOut]:
    result = await db.execute(
        select(
            Project.id,
            Project.name,
            Project.description,
            Project.created_at,
            User.email.label("user_email"),
            Repository.status.label("repo_status"),
        )
        .join(User, User.id == Project.user_id)
        .outerjoin(Repository, Repository.project_id == Project.id)
        .order_by(Project.created_at.desc())
        .limit(limit)
        .offset(offset)
    )
    return [
        AdminProjectOut(
            id=row[0],
            name=row[1],
            description=row[2],
            created_at=row[3],
            user_email=row[4],
            repo_status=row[5],
        )
        for row in result.fetchall()
    ]