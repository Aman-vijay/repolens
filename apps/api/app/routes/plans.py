import uuid
from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.deps import get_current_user, get_db_session
from app.middleware.rate_limit import limiter
from app.schemas.plan import (
    PlanRequest,
    PlanRefineRequest,
    PlanSessionOut,
    PlanSessionDetailOut,
    PlanVersionOut,
)
from app.services import project_service, plan_service
from repolens_db import User

router = APIRouter(tags=["plans"])

RATE_LIMIT_PLANS = "15/minute"


@router.post(
    "/projects/{project_id}/plans",
    response_model=PlanSessionOut,
    status_code=status.HTTP_201_CREATED,
)
@limiter.limit(RATE_LIMIT_PLANS)
async def create_project_plan(
    request: Request,
    project_id: uuid.UUID,
    body: PlanRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session),
):
    """Creates a new plan session and initiates version 1 generation."""
    project = await project_service.get_owned_project_or_404(db, project_id, current_user)
    session = await plan_service.create_plan_session(
        db, project.id, current_user.id, body.feature_request
    )
    return session


@router.get(
    "/projects/{project_id}/plans",
    response_model=list[PlanSessionOut],
)
@limiter.limit(RATE_LIMIT_PLANS)
async def list_project_plans(
    request: Request,
    project_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session),
):
    """Lists all plan sessions for a project."""
    project = await project_service.get_owned_project_or_404(db, project_id, current_user)
    sessions = await plan_service.list_plan_sessions(db, project.id, current_user.id)
    return sessions


@router.get(
    "/projects/{project_id}/plans/{session_id}",
    response_model=PlanSessionDetailOut,
)
@limiter.limit(RATE_LIMIT_PLANS)
async def get_project_plan_detail(
    request: Request,
    project_id: uuid.UUID,
    session_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session),
):
    """Retrieves detailed plan session information including all versions."""
    project = await project_service.get_owned_project_or_404(db, project_id, current_user)
    try:
        session = await plan_service.get_plan_session_detail(
            db, project.id, current_user.id, session_id
        )
        return session
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Plan session not found",
        )


@router.post(
    "/projects/{project_id}/plans/{session_id}/refine",
    response_model=PlanVersionOut,
    status_code=status.HTTP_201_CREATED,
)
@limiter.limit(RATE_LIMIT_PLANS)
async def refine_project_plan(
    request: Request,
    project_id: uuid.UUID,
    session_id: uuid.UUID,
    body: PlanRefineRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session),
):
    """Submits follow-up requirements to generate a new refined version of the plan."""
    project = await project_service.get_owned_project_or_404(db, project_id, current_user)
    try:
        version = await plan_service.refine_plan(
            db, session_id, current_user.id, body.refinement_prompt
        )
        return version
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Plan session not found",
        )


@router.delete(
    "/projects/{project_id}/plans/{session_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
@limiter.limit(RATE_LIMIT_PLANS)
async def delete_project_plan(
    request: Request,
    project_id: uuid.UUID,
    session_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session),
):
    """Deletes an entire plan session."""
    project = await project_service.get_owned_project_or_404(db, project_id, current_user)
    deleted = await plan_service.delete_plan_session(
        db, project.id, current_user.id, session_id
    )
    if not deleted:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Plan session not found",
        )
    return None
