import asyncio

import httpx
from fastapi import APIRouter, Depends, HTTPException, status

from app.deps import get_current_user
from app.schemas import GitHubRepoOut
from app.settings import get_settings
from repolens_db import User

router = APIRouter(tags=["github"])


@router.get("/github/repos", response_model=list[GitHubRepoOut])
async def list_github_repos(
    current_user: User = Depends(get_current_user),
):
    settings = get_settings()

    from clerk_backend_api import Clerk

    clerk = Clerk(bearer_auth=settings.clerk_secret_key)

    tokens = await asyncio.to_thread(
        clerk.users.get_o_auth_access_token,
        user_id=current_user.clerk_user_id,
        provider="oauth_github",
    )

    if not tokens:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=(
                "No GitHub OAuth token is stored for this Clerk user. "
                "Enable the GitHub social connection with the required scopes "
                "in this Clerk instance, then sign out and sign in with GitHub again."
            ),
        )

    token = tokens[0].token

    async with httpx.AsyncClient() as client:
        resp = await client.get(
            "https://api.github.com/user/repos",
            params={"sort": "updated", "per_page": 100},
            headers={
                "Authorization": f"Bearer {token}",
                "Accept": "application/vnd.github+json",
            },
        )
        resp.raise_for_status()

    repos = resp.json()
    return [
        GitHubRepoOut(
            name=r["name"],
            full_name=r["full_name"],
            html_url=r["html_url"],
            description=r.get("description"),
            private=r["private"],
            default_branch=r.get("default_branch"),
            language=r.get("language"),
            stargazers_count=r.get("stargazers_count", 0),
            updated_at=r.get("updated_at"),
        )
        for r in repos
    ]
