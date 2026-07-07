"""Tests for repository feature - attach and poll operations."""
import pytest
import pytest_asyncio
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession


@pytest.mark.asyncio
async def test_attach_repository_requires_project(
    authenticated_client: AsyncClient,
    db_session: AsyncSession,
):
    """Verify attaching a repository to a project."""
    project_resp = await authenticated_client.post(
        "/api/projects",
        json={"name": "Test Project for Repo"},
    )
    project_id = project_resp.json()["id"]

    repo_resp = await authenticated_client.post(
        f"/api/projects/{project_id}/repository",
        json={"url": "https://github.com/test/repo"},
    )
    assert repo_resp.status_code == 202
    data = repo_resp.json()
    assert data["url"] == "https://github.com/test/repo"
    assert data["status"] == "pending"


@pytest.mark.asyncio
async def test_get_repository(
    authenticated_client: AsyncClient,
    db_session: AsyncSession,
):
    """Verify getting repository details for a project."""
    project_resp = await authenticated_client.post(
        "/api/projects",
        json={"name": "Test Project"},
    )
    project_id = project_resp.json()["id"]

    await authenticated_client.post(
        f"/api/projects/{project_id}/repository",
        json={"url": "https://github.com/test/repo"},
    )

    repo_resp = await authenticated_client.get(f"/api/projects/{project_id}/repository")
    assert repo_resp.status_code == 200
    data = repo_resp.json()
    assert data["url"] == "https://github.com/test/repo"


@pytest.mark.asyncio
async def test_get_project_detail(
    authenticated_client: AsyncClient,
    db_session: AsyncSession,
):
    """Verify getting project detail with repository."""
    project_resp = await authenticated_client.post(
        "/api/projects",
        json={"name": "Test Project with Detail"},
    )
    project_id = project_resp.json()["id"]

    await authenticated_client.post(
        f"/api/projects/{project_id}/repository",
        json={"url": "https://github.com/test/repo"},
    )

    detail_resp = await authenticated_client.get(f"/api/projects/{project_id}")
    assert detail_resp.status_code == 200
    data = detail_resp.json()
    assert data["name"] == "Test Project with Detail"
    assert data["repository"] is not None
    assert data["repository"]["url"] == "https://github.com/test/repo"
