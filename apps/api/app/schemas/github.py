"""GitHub schemas — output for GitHub repo proxy.

RATE_LIMIT: 20 req/min per user (proxies GitHub API, inherit their rate limit too)
ACCESS_LEVEL: authenticated user
"""
from pydantic import BaseModel


class GitHubRepoOut(BaseModel):
    name: str
    full_name: str
    html_url: str
    description: str | None
    private: bool
    default_branch: str | None
    language: str | None
    stargazers_count: int
    updated_at: str | None

    model_config = {"from_attributes": True}


RATE_LIMIT = "20 per minute"
ACCESS_LEVEL = "user"