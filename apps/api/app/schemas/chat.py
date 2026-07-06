import uuid
from datetime import datetime
from typing import List, Optional, Literal, Any
from pydantic import BaseModel, field_validator, model_validator


class ChatMessage(BaseModel):
    id: Optional[str] = None
    role: Literal["system", "user", "assistant", "tool"]
    content: str = ""
    parts: list[dict[str, Any]] | None = None

    @model_validator(mode="before")
    @classmethod
    def extract_content_from_parts(cls, data: Any) -> Any:
        """Handle Vercel AI SDK's UIMessage format where content comes inside parts[]."""
        if isinstance(data, dict):
            content = data.get("content", "")
            if not content:
                parts = data.get("parts")
                if parts and isinstance(parts, list):
                    content = "".join(
                        p.get("text", "") for p in parts if isinstance(p, dict) and p.get("type") == "text"
                    )
                    data["content"] = content
        return data


class ChatRequest(BaseModel):
    messages: List[ChatMessage]
    id: Optional[str] = None
    trigger: Optional[str] = None

    model_config = {"extra": "ignore"}


class ChatMessageOut(BaseModel):
    id: uuid.UUID
    role: str
    content: str
    extra: dict[str, Any] | None = None
    created_at: datetime

    model_config = {"from_attributes": True}


class ChatSessionOut(BaseModel):
    id: uuid.UUID
    project_id: uuid.UUID
    title: str
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class ChatSessionDetailOut(ChatSessionOut):
    messages: list[ChatMessageOut] = []


RATE_LIMIT_CHAT = "15 per minute"
RATE_LIMIT_SESSIONS = "30 per minute"
ACCESS_LEVEL = "user"