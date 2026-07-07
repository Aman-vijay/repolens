"""Tests for planner feature - plan generation and refinement."""
import pytest
import pytest_asyncio
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession


@pytest.mark.asyncio
async def test_create_plan_session(
    authenticated_client: AsyncClient,
    db_session: AsyncSession,
):
    """Test creating a plan session."""
    project_resp = await authenticated_client.post(
        "/api/projects",
        json={"name": "Plan Test Project"},
    )
    project_id = project_resp.json()["id"]

    response = await authenticated_client.post(
        f"/api/projects/{project_id}/plans",
        json={"feature_request": "Add user authentication"},
    )
    assert response.status_code == 201
    data = response.json()
    assert data["feature_request"] == "Add user authentication"
    assert "id" in data


@pytest.mark.asyncio
async def test_list_plan_sessions(
    authenticated_client: AsyncClient,
    db_session: AsyncSession,
):
    """Test listing plan sessions for a project."""
    project_resp = await authenticated_client.post(
        "/api/projects",
        json={"name": "List Plans Test"},
    )
    project_id = project_resp.json()["id"]

    await authenticated_client.post(
        f"/api/projects/{project_id}/plans",
        json={"feature_request": "Add dark mode"},
    )

    response = await authenticated_client.get(f"/api/projects/{project_id}/plans")
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 1
    assert data[0]["feature_request"] == "Add dark mode"


@pytest.mark.asyncio
async def test_plan_schema_structure(
    authenticated_client: AsyncClient,
    db_session: AsyncSession,
):
    """Test that plan response conforms to expected JSON schema."""
    project_resp = await authenticated_client.post(
        "/api/projects",
        json={"name": "Schema Test Project"},
    )
    project_id = project_resp.json()["id"]

    plan_resp = await authenticated_client.post(
        f"/api/projects/{project_id}/plans",
        json={"feature_request": "Build REST API"},
    )
    assert plan_resp.status_code == 201

    plan_data = plan_resp.json()
    assert "id" in plan_data
    assert "title" in plan_data or "feature_request" in plan_data
