"""Project schemas — input/output for project endpoints.

RATE_LIMIT: 30 req/min per user (creating/listing projects is not expensive)
ACCESS_LEVEL: authenticated user
"""
import uuid
from datetime import datetime

from pydantic import BaseModel, Field
from app.schemas.repository import RepositoryOut


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
    repository: RepositoryOut | None = None

    model_config = {"from_attributes": True}


RATE_LIMIT = "30 per minute"
ACCESS_LEVEL = "user"