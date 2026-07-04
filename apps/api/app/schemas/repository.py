"""Repository schemas — input/output for repository endpoints.

RATE_LIMIT: 10 req/min per user (clone triggers a background job)
ACCESS_LEVEL: authenticated user (project owner)
"""
import uuid
from datetime import datetime
from typing import Any

from pydantic import BaseModel, Field


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


RATE_LIMIT_ATTACH = "10 per minute"
RATE_LIMIT_POLL = "60 per minute"
ACCESS_LEVEL = "user"