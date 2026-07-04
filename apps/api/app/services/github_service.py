"""GitHub service — business logic for GitHub OAuth token retrieval and repo listing.

Optimizations:
- Reuses the module-level Clerk client from deps (no per-call SDK init)
- Uses a module-level httpx.AsyncClient for connection pooling
"""
import asyncio

import httpx
from fastapi import HTTPException, status

from app.deps import _get_clerk_client
from app.schemas import GitHubRepoOut
from app.settings import get_settings
from repolens_db import User

GITHUB_API_REPOS = "https://api.github.com/user/repos"

_http_client: httpx.AsyncClient | None = None


def _get_http_client() -> httpx.AsyncClient:
    global _http_client
    if _http_client is None or _http_client.is_closed:
        _http_client = httpx.AsyncClient(timeout=15.0)
    return _http_client


async def list_user_repos(user: User) -> list[GitHubRepoOut]:
    settings = get_settings()
    clerk = _get_clerk_client()

    tokens = await asyncio.to_thread(
        clerk.users.get_o_auth_access_token,
        user_id=user.clerk_user_id,
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

    client = _get_http_client()
    resp = await client.get(
        GITHUB_API_REPOS,
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