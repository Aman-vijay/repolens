"""Search schemas — input/output for semantic code search.

RATE_LIMIT: 20 req/min per user (OpenAI embedding call + pgvector query)
ACCESS_LEVEL: authenticated user (project owner)
"""
import uuid
from datetime import datetime

from pydantic import BaseModel, Field


class SearchQuery(BaseModel):
    query: str = Field(..., min_length=1, max_length=500)
    limit: int = Field(default=10, ge=1, le=50)


class SearchHitOut(BaseModel):
    id: uuid.UUID
    file_path: str
    language: str
    start_line: int
    end_line: int
    content: str
    chunk_index: int
    score: float

    model_config = {"from_attributes": True}


RATE_LIMIT = "20 per minute"
ACCESS_LEVEL = "user"