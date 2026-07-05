import uuid
from fastapi import APIRouter, Depends, Request
from fastapi.responses import StreamingResponse

from app.deps import get_current_user, get_db_session
from app.middleware.rate_limit import limiter
from app.schemas.chat import ChatRequest
from app.services import project_service
from app.services.chat_service import stream_chat
from sqlalchemy.ext.asyncio import AsyncSession
from repolens_db import User

router = APIRouter(tags=["chat"])

@router.post("/projects/{project_id}/chat")
@limiter.limit("15/minute")
async def chat_endpoint(
    request: Request,
    project_id: uuid.UUID,
    body: ChatRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session)
):
    """Streams codebase chat responses matching the Vercel AI Data Stream Protocol (v1)."""
    # 1. Authorize project access
    project = await project_service.get_owned_project_or_404(db, project_id, current_user)
    
    # 2. Return SSE streaming response
    return StreamingResponse(
        stream_chat(db, project.id, body.messages),
        media_type="text/event-stream",
        headers={
            "X-Vercel-AI-Data-Stream": "v1",
            "Cache-Control": "no-cache",
            "Connection": "keep-alive"
        }
    )
