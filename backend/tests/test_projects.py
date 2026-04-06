"""
Tests for project and site CRUD endpoints.
Geometry operations are skipped in SQLite mode (no PostGIS).
"""
import pytest
from httpx import AsyncClient

REGISTER_URL = "/api/v1/auth/register"
LOGIN_URL = "/api/v1/auth/login"
PROJECTS_URL = "/api/v1/projects/"


async def _auth_headers(client: AsyncClient, email: str) -> dict:
    await client.post(REGISTER_URL, json={"email": email, "password": "SecurePass1!"})
    login = await client.post(LOGIN_URL, json={"email": email, "password": "SecurePass1!"})
    return {"Authorization": f"Bearer {login.json()['access_token']}"}


@pytest.mark.asyncio
async def test_create_project(client: AsyncClient):
    headers = await _auth_headers(client, "proj_user@example.com")
    resp = await client.post(
        PROJECTS_URL,
        json={"name": "Amazon Watch", "description": "Monitoring deforestation"},
        headers=headers,
    )
    assert resp.status_code == 201
    data = resp.json()
    assert data["name"] == "Amazon Watch"
    assert data["status"] == "active"


@pytest.mark.asyncio
async def test_list_projects_empty(client: AsyncClient):
    headers = await _auth_headers(client, "empty_user@example.com")
    resp = await client.get(PROJECTS_URL, headers=headers)
    assert resp.status_code == 200
    assert resp.json() == []


@pytest.mark.asyncio
async def test_update_project(client: AsyncClient):
    headers = await _auth_headers(client, "update_user@example.com")
    create = await client.post(
        PROJECTS_URL, json={"name": "Old Name"}, headers=headers
    )
    pid = create.json()["id"]
    resp = await client.patch(
        f"{PROJECTS_URL}{pid}",
        json={"name": "New Name", "status": "archived"},
        headers=headers,
    )
    assert resp.status_code == 200
    assert resp.json()["name"] == "New Name"
    assert resp.json()["status"] == "archived"


@pytest.mark.asyncio
async def test_delete_project(client: AsyncClient):
    headers = await _auth_headers(client, "delete_user@example.com")
    create = await client.post(
        PROJECTS_URL, json={"name": "Temp Project"}, headers=headers
    )
    pid = create.json()["id"]
    del_resp = await client.delete(f"{PROJECTS_URL}{pid}", headers=headers)
    assert del_resp.status_code == 204
    get_resp = await client.get(f"{PROJECTS_URL}{pid}", headers=headers)
    assert get_resp.status_code == 404


@pytest.mark.asyncio
async def test_project_isolation(client: AsyncClient):
    """Users cannot see each other's projects."""
    headers_a = await _auth_headers(client, "userA@example.com")
    headers_b = await _auth_headers(client, "userB@example.com")
    create = await client.post(
        PROJECTS_URL, json={"name": "Secret Project"}, headers=headers_a
    )
    pid = create.json()["id"]
    resp = await client.get(f"{PROJECTS_URL}{pid}", headers=headers_b)
    assert resp.status_code == 404
