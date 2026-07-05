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


class LLMChunkExplanation(BaseModel):
    index: int = Field(..., description="0-based index of the code chunk in the provided list of search results")
    symbol_name: str | None = Field(None, description="Function or Class name being explained, if applicable")
    highlight_start_line: int = Field(..., description="First line number of the specific section to highlight/emphasize")
    highlight_end_line: int = Field(..., description="Last line number of the specific section to highlight/emphasize")
    role: str = Field(..., description="Role of this chunk: 'entry_point', 'main_implementation', 'supporting_utility', 'configuration', 'tests'")
    relevance_reason: str = Field(..., description="Concise reason why this chunk is relevant to the query and what role it plays")
    explanation: str = Field(..., description="Concise explanation of what this piece of code does, why it is relevant, and how it fits into the architecture")

class LLMSearchExplanation(BaseModel):
    architectural_context: str = Field(..., description="Where this code belongs within the system architecture (e.g. Authentication, Background Worker, AI Pipeline, API Layer)")
    quick_understanding: str = Field(..., description="A short 2-5 sentence plain English summary of the complete feature")
    execution_flow: str | None = Field(None, description="ASCII sequence/flowchart showing request/execution flow across components (if applicable, e.g. Client -> FastAPI -> Clerk)")
    explanations: list[LLMChunkExplanation] = Field(..., description="Explanations for the code chunks, ordered by relevance")
    related_files: list[str] = Field(..., description="List of other relevant file paths in the repo to inspect next")


class ChunkExplanationOut(BaseModel):
    id: uuid.UUID
    file_path: str
    language: str
    start_line: int
    end_line: int
    content: str
    chunk_index: int
    score: float
    symbol_name: str | None = None
    highlight_start_line: int
    highlight_end_line: int
    role: str
    relevance_reason: str
    explanation: str

    model_config = {"from_attributes": True}


class SearchExplanationOut(BaseModel):
    architectural_context: str
    quick_understanding: str
    execution_flow: str | None = None
    explanations: list[ChunkExplanationOut]
    related_files: list[str]


RATE_LIMIT = "20 per minute"
ACCESS_LEVEL = "user"