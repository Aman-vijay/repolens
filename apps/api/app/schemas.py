import uuid
from datetime import datetime
from typing import Any

from pydantic import BaseModel, Field


class ProjectCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    description: str | None = None


class ProjectOut(BaseModel):
    id: uuid.UUID
    name: str
    description: str | None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class ProjectDetailOut(BaseModel):
    id: uuid.UUID
    name: str
    description: str | None
    created_at: datetime
    updated_at: datetime
    repository: "RepositoryOut | None" = None

    model_config = {"from_attributes": True}


class RepositoryCreate(BaseModel):
    url: str = Field(..., min_length=1, max_length=2048)


class RepositoryOut(BaseModel):
    id: uuid.UUID
    project_id: uuid.UUID
    url: str
    status: str
    progress: int
    default_branch: str | None
    file_count: int
    total_size_bytes: int
    languages: dict[str, Any] | None
    file_tree: dict[str, Any] | None
    error_message: str | None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


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


ProjectDetailOut.model_rebuild()