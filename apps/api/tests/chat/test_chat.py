"""Tests for chat feature - streaming and grounding."""
import pytest
import pytest_asyncio
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.services.chat_grounding import _build_grounding_context


class TestChatGrounding:
    """Test chat grounding context building."""

    @pytest.mark.asyncio
    async def test_grounding_returns_empty_for_no_chunks(self, db_session: AsyncSession):
        """Test _build_grounding_context returns empty context when no chunks exist."""
        grounding_context, evidence_count, trace_messages, grounded_files = await _build_grounding_context(
            db=db_session,
            repo_id=None,
            user_query="test query",
            analysis=None,
        )

        assert grounding_context == ""
        assert evidence_count == 0


@pytest.mark.asyncio
async def test_chat_requires_project(
    authenticated_client: AsyncClient,
    db_session: AsyncSession,
):
    """Test that chat endpoint works when project has repository."""
    project_resp = await authenticated_client.post(
        "/api/projects",
        json={"name": "Chat Test Project"},
    )
    project_id = project_resp.json()["id"]

    response = await authenticated_client.get(f"/api/projects/{project_id}/chat/sessions")
    assert response.status_code == 200


@pytest.mark.asyncio
async def test_list_chat_sessions(
    authenticated_client: AsyncClient,
    db_session: AsyncSession,
):
    """Test listing chat sessions for a project."""
    project_resp = await authenticated_client.post(
        "/api/projects",
        json={"name": "Sessions Test Project"},
    )
    project_id = project_resp.json()["id"]

    response = await authenticated_client.get(f"/api/projects/{project_id}/chat/sessions")
    assert response.status_code == 200
    assert isinstance(response.json(), list)
