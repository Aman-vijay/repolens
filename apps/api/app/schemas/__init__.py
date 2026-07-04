"""Schema package — per-domain input/output schemas + endpoint metadata.

Each module defines:
- Input schemas (Pydantic models for request body validation)
- Output schemas (Pydantic models for response serialization)
- RATE_LIMIT constant (applied via slowapi decorator on the route)
- ACCESS_LEVEL constant (documented; enforced via FastAPI dependencies)

Lifecycle order on every request:
  1. Data Validation  — Pydantic validates the body before the handler runs
  2. Rate Limiting    — slowapi checks Redis before the handler runs
  3. Authentication   — FastAPI Depends(get_current_user) verifies the Clerk JWT
  4. Handler          — calls service layer, returns result
  5. Response         — FastAPI serializes via response_model
"""
from app.schemas.project import (
    ProjectCreate,
    ProjectDetailOut,
    ProjectOut,
)
from app.schemas.repository import (
    RepositoryCreate,
    RepositoryOut,
)
from app.schemas.github import GitHubRepoOut
from app.schemas.admin import (
    AdminProjectOut,
    AdminStatsOut,
    AdminUserOut,
)
from app.schemas.api_response import APIResponse, APIError

__all__ = [
    "ProjectCreate",
    "ProjectOut",
    "ProjectDetailOut",
    "RepositoryCreate",
    "RepositoryOut",
    "GitHubRepoOut",
    "AdminStatsOut",
    "AdminUserOut",
    "AdminProjectOut",
    "APIResponse",
    "APIError",
]