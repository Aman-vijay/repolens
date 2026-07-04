from fastapi import APIRouter, Depends, Request

from app.deps import get_current_user
from app.middleware.rate_limit import limiter
from app.schemas.github import GitHubRepoOut, RATE_LIMIT
from app.services import github_service
from repolens_db import User

router = APIRouter(tags=["github"])


@router.get("/github/repos", response_model=list[GitHubRepoOut])
@limiter.limit(RATE_LIMIT)
async def list_github_repos(
    request: Request,
    current_user: User = Depends(get_current_user),
):
    return await github_service.list_user_repos(current_user)