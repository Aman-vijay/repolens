"""Tests for analysis feature - analysis generation and retrieval."""
import pytest
import pytest_asyncio
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession


@pytest.mark.asyncio
async def test_get_analysis_requires_repository(
    authenticated_client: AsyncClient,
    db_session: AsyncSession,
):
    """Test that getting analysis requires a repository to be attached."""
    project_resp = await authenticated_client.post(
        "/api/projects",
        json={"name": "Analysis Test Project"},
    )
    project_id = project_resp.json()["id"]

    response = await authenticated_client.get(f"/api/projects/{project_id}/analysis")
    assert response.status_code == 404
    assert "No repository attached" in response.json()["detail"]


@pytest.mark.asyncio
async def test_analysis_regenerate_requires_ready_repository(
    authenticated_client: AsyncClient,
    db_session: AsyncSession,
):
    """Test that regenerating analysis requires repository to be in ready status."""
    project_resp = await authenticated_client.post(
        "/api/projects",
        json={"name": "Regenerate Test"},
    )
    project_id = project_resp.json()["id"]

    await authenticated_client.post(
        f"/api/projects/{project_id}/repository",
        json={"url": "https://github.com/test/repo"},
    )

    response = await authenticated_client.post(f"/api/projects/{project_id}/analysis/regenerate")
    assert response.status_code == 400
    assert "not fully cloned" in response.json()["detail"]
