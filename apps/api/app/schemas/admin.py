"""Admin schemas — output for admin dashboard endpoints.

RATE_LIMIT: 60 req/min per superuser (read-only dashboard data)
ACCESS_LEVEL: superuser only
"""
import uuid
from datetime import datetime

from pydantic import BaseModel


class AdminStatsOut(BaseModel):
    total_users: int
    total_projects: int
    total_repos: int
    repos_by_status: dict[str, int]


class AdminUserOut(BaseModel):
    id: uuid.UUID
    clerk_user_id: str
    email: str
    is_superuser: bool
    created_at: datetime
    project_count: int

    model_config = {"from_attributes": True}


class AdminProjectOut(BaseModel):
    id: uuid.UUID
    name: str
    description: str | None
    created_at: datetime
    user_email: str
    repo_status: str | None

    model_config = {"from_attributes": True}


RATE_LIMIT = "60 per minute"
ACCESS_LEVEL = "superuser"