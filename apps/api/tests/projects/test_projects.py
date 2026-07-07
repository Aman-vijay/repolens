"""Tests for project feature - CRUD operations."""
import pytest
import pytest_asyncio
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from repolens_db import User


@pytest.mark.asyncio
async def test_create_project_success(
    authenticated_client: AsyncClient,
    db_session: AsyncSession,
):
    """Verify creating a project successfully writes to Postgres."""
    response = await authenticated_client.post(
        "/api/projects",
        json={"name": "Test Project", "description": "A test project"},
    )
    assert response.status_code == 201
    data = response.json()
    assert data["name"] == "Test Project"
    assert data["description"] == "A test project"
    assert "id" in data


@pytest.mark.asyncio
async def test_create_project_duplicate_name_conflict(
    authenticated_client: AsyncClient,
    db_session: AsyncSession,
):
    """Verify creating a project with duplicate name (case-insensitive) rejects with 409."""
    await authenticated_client.post(
        "/api/projects",
        json={"name": "Unique Project"},
    )

    response = await authenticated_client.post(
        "/api/projects",
        json={"name": "UNIQUE PROJECT"},
    )
    assert response.status_code == 409


@pytest.mark.asyncio
async def test_list_projects(
    authenticated_client: AsyncClient,
    db_session: AsyncSession,
):
    """Verify listing projects returns user's projects."""
    await authenticated_client.post(
        "/api/projects",
        json={"name": "Project 1"},
    )
    await authenticated_client.post(
        "/api/projects",
        json={"name": "Project 2"},
    )

    response = await authenticated_client.get("/api/projects")
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 2


@pytest.mark.asyncio
async def test_update_project(
    authenticated_client: AsyncClient,
    db_session: AsyncSession,
):
    """Verify updating a project changes database state."""
    create_resp = await authenticated_client.post(
        "/api/projects",
        json={"name": "Original Name", "description": "Original desc"},
    )
    project_id = create_resp.json()["id"]

    response = await authenticated_client.patch(
        f"/api/projects/{project_id}",
        json={"name": "Updated Name"},
    )
    assert response.status_code == 200
    data = response.json()
    assert data["name"] == "Updated Name"
    assert data["description"] == "Original desc"


@pytest.mark.asyncio
async def test_delete_project(
    authenticated_client: AsyncClient,
    db_session: AsyncSession,
):
    """Verify deleting a project removes it from database."""
    create_resp = await authenticated_client.post(
        "/api/projects",
        json={"name": "To Be Deleted"},
    )
    project_id = create_resp.json()["id"]

    response = await authenticated_client.delete(f"/api/projects/{project_id}")
    assert response.status_code == 204

    list_resp = await authenticated_client.get("/api/projects")
    assert len(list_resp.json()) == 0
