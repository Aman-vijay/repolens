import uuid
from datetime import datetime
from pydantic import BaseModel

class AnalysisOut(BaseModel):
    id: uuid.UUID
    repository_id: uuid.UUID
    analysis_version: int
    analysis_status: str
    model: str
    prompt_version: str
    
    executive_summary: str | None
    architecture_summary: str | None
    architecture_style: str | None
    architecture_layers: list[str] | None
    tech_stack: dict | None
    repo_facts: dict | None
    repo_insights: dict | None
    source_context: dict | None
    token_usage: dict | None
    generation_latency_ms: int | None
    
    generated_at: datetime | None
    created_at: datetime

    class Config:
        from_attributes = True

class RegenerateResponse(BaseModel):
    status: str
    skipped: bool
