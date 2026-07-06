import uuid
from datetime import datetime
from typing import Any, Optional
from pydantic import BaseModel


class PlanRequest(BaseModel):
    feature_request: str


class PlanRefineRequest(BaseModel):
    refinement_prompt: str


class PlanVersionOut(BaseModel):
    id: uuid.UUID
    session_id: uuid.UUID
    version: int
    refinement_prompt: Optional[str] = None
    status: str
    plan_content: Optional[dict[str, Any]] = None
    model: str
    token_usage: Optional[dict[str, Any]] = None
    generation_latency_ms: Optional[int] = None
    error_message: Optional[str] = None
    created_at: datetime

    model_config = {"from_attributes": True}


class PlanSessionOut(BaseModel):
    id: uuid.UUID
    project_id: uuid.UUID
    title: str
    feature_request: str
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class PlanSessionDetailOut(PlanSessionOut):
    versions: list[PlanVersionOut] = []
