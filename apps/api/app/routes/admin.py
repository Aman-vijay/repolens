from fastapi import APIRouter, Depends, Query
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.deps import get_current_superuser, get_db_session
from app.schemas import AdminProjectOut, AdminStatsOut, AdminUserOut
from repolens_db import Project, Repository, User

router = APIRouter(prefix="/admin", tags=["admin"])


@router.get("/stats", response_model=AdminStatsOut)
async def admin_stats(
    _user: User = Depends(get_current_superuser),
    db: AsyncSession = Depends(get_db_session),
):
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


@router.get("/users", response_model=list[AdminUserOut])
async def admin_list_users(
    _user: User = Depends(get_current_superuser),
    db: AsyncSession = Depends(get_db_session),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
):
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
    rows = result.fetchall()
    return [
        AdminUserOut(
            id=row[0],
            clerk_user_id=row[1],
            email=row[2],
            is_superuser=row[3],
            created_at=row[4],
            project_count=row[5],
        )
        for row in rows
    ]


@router.get("/projects", response_model=list[AdminProjectOut])
async def admin_list_projects(
    _user: User = Depends(get_current_superuser),
    db: AsyncSession = Depends(get_db_session),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
):
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
    rows = result.fetchall()
    return [
        AdminProjectOut(
            id=row[0],
            name=row[1],
            description=row[2],
            created_at=row[3],
            user_email=row[4],
            repo_status=row[5],
        )
        for row in rows
    ]