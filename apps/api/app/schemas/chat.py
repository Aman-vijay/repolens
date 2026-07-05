from typing import List, Optional, Literal
from pydantic import BaseModel

class ChatMessage(BaseModel):
    id: Optional[str] = None
    role: Literal["system", "user", "assistant", "tool"]
    content: str

class ChatRequest(BaseModel):
    messages: List[ChatMessage]
