import re
import uuid
from typing import List, Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.schemas.chat import ChatMessageOut, ChatSessionOut, ChatSessionDetailOut
from repolens_db import ChatSession, ChatMessage as ChatMessageModel


# --- Chat Session CRUD ---

async def create_session(
    db: AsyncSession, project_id: uuid.UUID, user_id: uuid.UUID, title: str = "New Chat"
) -> ChatSession:
    session = ChatSession(project_id=project_id, user_id=user_id, title=title[:255])
    db.add(session)
    await db.commit()
    await db.refresh(session)
    return session


async def get_or_create_session(
    db: AsyncSession, project_id: uuid.UUID, user_id: uuid.UUID,
    session_id: Optional[str], user_content: str,
) -> ChatSession:
    if session_id:
        try:
            sid = uuid.UUID(session_id)
            result = await db.execute(
                select(ChatSession).where(
                    ChatSession.id == sid,
                    ChatSession.project_id == project_id,
                    ChatSession.user_id == user_id,
                )
            )
            session = result.scalar_one_or_none()
            if session:
                return session
        except (ValueError, Exception):
            pass

    # Clean up code blocks if user pasted code first
    clean_content = re.sub(r'```[\s\S]*?```', '', user_content).strip()
    if not clean_content:
        clean_content = user_content.strip()
    
    # Get the first non-empty line
    lines = [line.strip() for line in clean_content.split('\n') if line.strip()]
    first_line = lines[0] if lines else "New Chat"
    
    # Strip common markdown heading/list prefixes
    first_line = re.sub(r'^(#+\s*|-\s*|\*\s*|\d+\.\s*)', '', first_line).strip()
    
    # Limit length and append ellipsis if truncated
    max_len = 45
    if len(first_line) > max_len:
        title = first_line[:max_len].strip() + "..."
    else:
        title = first_line or "New Chat"

    return await create_session(db, project_id, user_id, title)


async def list_sessions(
    db: AsyncSession, project_id: uuid.UUID, user_id: uuid.UUID
) -> List[ChatSessionOut]:
    result = await db.execute(
        select(ChatSession)
        .where(
            ChatSession.project_id == project_id,
            ChatSession.user_id == user_id,
        )
        .order_by(ChatSession.updated_at.desc())
    )
    sessions = result.scalars().all()
    return [ChatSessionOut.model_validate(s) for s in sessions]


async def get_session_detail(
    db: AsyncSession, project_id: uuid.UUID, user_id: uuid.UUID, session_id: uuid.UUID
) -> ChatSessionDetailOut:
    result = await db.execute(
        select(ChatSession)
        .where(
            ChatSession.id == session_id,
            ChatSession.project_id == project_id,
            ChatSession.user_id == user_id,
        )
        .options(selectinload(ChatSession.messages))
    )
    session = result.scalar_one_or_none()
    if session is None:
        raise ValueError("Session not found")

    return ChatSessionDetailOut(
        id=session.id,
        project_id=session.project_id,
        title=session.title,
        created_at=session.created_at,
        updated_at=session.updated_at,
        messages=[
            ChatMessageOut(
                id=m.id,
                role=m.role,
                content=m.content,
                extra=m.extra,
                created_at=m.created_at,
            )
            for m in session.messages
        ],
    )


async def save_message(
    db: AsyncSession, session_id: uuid.UUID, role: str, content: str,
    extra: Optional[dict] = None,
) -> ChatMessageModel:
    msg = ChatMessageModel(
        session_id=session_id,
        role=role,
        content=content,
        extra=extra,
    )
    db.add(msg)
    await db.commit()
    await db.refresh(msg)
    return msg


async def delete_session(
    db: AsyncSession, project_id: uuid.UUID, user_id: uuid.UUID, session_id: uuid.UUID
) -> bool:
    result = await db.execute(
        select(ChatSession).where(
            ChatSession.id == session_id,
            ChatSession.project_id == project_id,
            ChatSession.user_id == user_id,
        )
    )
    session = result.scalar_one_or_none()
    if session is None:
        return False
    await db.delete(session)
    await db.commit()
    return True
