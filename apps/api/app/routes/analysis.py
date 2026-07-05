import uuid
from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.deps import get_current_user, get_db_session
from app.middleware.rate_limit import limiter
from app.schemas.analysis import AnalysisOut, RegenerateResponse
from app.services import project_service
from app.services.queue import enqueue_analysis
from repolens_db import Repository, RepositoryAnalysis, User

router = APIRouter(tags=["analysis"])

@router.get(
    "/projects/{project_id}/analysis",
    response_model=AnalysisOut,
)
@limiter.limit("20/minute")
async def get_latest_analysis(
    request: Request,
    project_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session),
):
    # Verify project ownership
    project = await project_service.get_owned_project_or_404(db, project_id, current_user)
    
    # Get repository
    repo_result = await db.execute(
        select(Repository).where(Repository.project_id == project.id)
    )
    repo = repo_result.scalar_one_or_none()
    if repo is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No repository attached to this project",
        )
        
    # Get latest analysis (any status)
    stmt = (
        select(RepositoryAnalysis)
        .where(RepositoryAnalysis.repository_id == repo.id)
        .order_by(RepositoryAnalysis.analysis_version.desc())
        .limit(1)
    )
    result = await db.execute(stmt)
    analysis = result.scalar_one_or_none()
    if analysis is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No analysis generated yet for this repository",
        )
        
    return analysis

@router.post(
    "/projects/{project_id}/analysis/regenerate",
    response_model=RegenerateResponse,
)
@limiter.limit("10/minute")
async def regenerate_analysis(
    request: Request,
    project_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session),
):
    # Verify project ownership
    project = await project_service.get_owned_project_or_404(db, project_id, current_user)
    
    # Get repository
    repo_result = await db.execute(
        select(Repository).where(Repository.project_id == project.id)
    )
    repo = repo_result.scalar_one_or_none()
    if repo is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No repository attached to this project",
        )
        
    if repo.status != "ready":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Repository is not fully cloned/indexed yet",
        )

    # Check if there is already a running analysis
    stmt = (
        select(RepositoryAnalysis)
        .where(RepositoryAnalysis.repository_id == repo.id)
        .order_by(RepositoryAnalysis.analysis_version.desc())
        .limit(1)
    )
    res = await db.execute(stmt)
    latest = res.scalar_one_or_none()
    if latest and latest.analysis_status in {"pending", "running"}:
         return RegenerateResponse(status="running", skipped=True)

    # Queue new analysis job (force=True since user manually requested it)
    await enqueue_analysis(repository_id=str(repo.id), force=True)
    return RegenerateResponse(status="queued", skipped=False)
