import uuid

from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.responses import StreamingResponse, JSONResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.deps import get_current_user, get_db_session
from app.middleware.rate_limit import limiter
from app.schemas.chat import (
    RATE_LIMIT_CHAT,
    RATE_LIMIT_SESSIONS,
    ChatRequest,
    ChatSessionDetailOut,
    ChatSessionOut,
)
from app.services import project_service
from app.services.chat_service import (
    delete_session,
    get_or_create_session,
    get_session_detail,
    list_sessions,
    save_message,
    stream_chat,
)
from repolens_db import User

router = APIRouter(tags=["chat"])


@router.post("/projects/{project_id}/chat")
@limiter.limit(RATE_LIMIT_CHAT)
async def chat_endpoint(
    request: Request,
    project_id: uuid.UUID,
    body: ChatRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session),
):
    """Streams codebase chat responses and persists messages to DB."""
    project = await project_service.get_owned_project_or_404(db, project_id, current_user)

    # Extract the user's latest message content
    user_content = body.messages[-1].content if body.messages else ""

    # Get or create a chat session
    session = await get_or_create_session(
        db, project.id, current_user.id, body.id, user_content,
    )

    # Save the user's message to DB BEFORE streaming
    await save_message(db, session.id, "user", user_content)

    # Stream the assistant response (persisted after streaming completes inside stream_chat)
    return StreamingResponse(
        stream_chat(
            db, project.id, body.messages,
            session_id=session.id,
            user_id=current_user.id,
        ),
        media_type="text/event-stream",
        headers={
            "X-Vercel-AI-Data-Stream": "v1",
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
        },
    )


@router.get("/projects/{project_id}/chat")
@limiter.limit(RATE_LIMIT_SESSIONS)
async def get_chat_history(
    request: Request,
    project_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session),
):
    """Return empty chat history — messages are stored in DB sessions."""
    await project_service.get_owned_project_or_404(db, project_id, current_user)
    return JSONResponse({"messages": []})


@router.get(
    "/projects/{project_id}/chat/sessions",
    response_model=list[ChatSessionOut],
)
@limiter.limit(RATE_LIMIT_SESSIONS)
async def list_chat_sessions(
    request: Request,
    project_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session),
):
    """List all chat sessions for a project."""
    await project_service.get_owned_project_or_404(db, project_id, current_user)
    return await list_sessions(db, project_id, current_user.id)


@router.get(
    "/projects/{project_id}/chat/sessions/{session_id}",
    response_model=ChatSessionDetailOut,
)
@limiter.limit(RATE_LIMIT_SESSIONS)
async def get_chat_session(
    request: Request,
    project_id: uuid.UUID,
    session_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session),
):
    """Get a specific chat session with all messages."""
    await project_service.get_owned_project_or_404(db, project_id, current_user)
    try:
        return await get_session_detail(db, project_id, current_user.id, session_id)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Chat session not found",
        )


@router.delete(
    "/projects/{project_id}/chat/sessions/{session_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
@limiter.limit(RATE_LIMIT_SESSIONS)
async def delete_chat_session(
    request: Request,
    project_id: uuid.UUID,
    session_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session),
):
    """Delete a chat session and all its messages."""
    await project_service.get_owned_project_or_404(db, project_id, current_user)
    deleted = await delete_session(db, project_id, current_user.id, session_id)
    if not deleted:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Chat session not found",
        )
    return None