import pytest
from httpx import AsyncClient


REGISTER_URL = "/api/v1/auth/register"
LOGIN_URL = "/api/v1/auth/login"
ME_URL = "/api/v1/auth/me"


@pytest.mark.asyncio
async def test_register_success(client: AsyncClient):
    resp = await client.post(
        REGISTER_URL,
        json={"email": "alice@example.com", "password": "SecurePass1!", "full_name": "Alice"},
    )
    assert resp.status_code == 201
    data = resp.json()
    assert data["email"] == "alice@example.com"
    assert "id" in data
    assert "hashed_password" not in data


@pytest.mark.asyncio
async def test_register_duplicate_email(client: AsyncClient):
    payload = {"email": "bob@example.com", "password": "SecurePass1!"}
    await client.post(REGISTER_URL, json=payload)
    resp = await client.post(REGISTER_URL, json=payload)
    assert resp.status_code == 409


@pytest.mark.asyncio
async def test_register_weak_password(client: AsyncClient):
    resp = await client.post(
        REGISTER_URL, json={"email": "weak@example.com", "password": "short"}
    )
    assert resp.status_code == 422


@pytest.mark.asyncio
async def test_login_success(client: AsyncClient):
    await client.post(
        REGISTER_URL,
        json={"email": "carol@example.com", "password": "SecurePass1!"},
    )
    resp = await client.post(
        LOGIN_URL, json={"email": "carol@example.com", "password": "SecurePass1!"}
    )
    assert resp.status_code == 200
    tokens = resp.json()
    assert "access_token" in tokens
    assert "refresh_token" in tokens
    assert tokens["token_type"] == "bearer"


@pytest.mark.asyncio
async def test_login_wrong_password(client: AsyncClient):
    await client.post(
        REGISTER_URL,
        json={"email": "dave@example.com", "password": "SecurePass1!"},
    )
    resp = await client.post(
        LOGIN_URL, json={"email": "dave@example.com", "password": "WrongPassword!"}
    )
    assert resp.status_code == 401


@pytest.mark.asyncio
async def test_me_authenticated(client: AsyncClient):
    await client.post(
        REGISTER_URL,
        json={"email": "eve@example.com", "password": "SecurePass1!"},
    )
    login = await client.post(
        LOGIN_URL, json={"email": "eve@example.com", "password": "SecurePass1!"}
    )
    token = login.json()["access_token"]
    resp = await client.get(ME_URL, headers={"Authorization": f"Bearer {token}"})
    assert resp.status_code == 200
    assert resp.json()["email"] == "eve@example.com"


@pytest.mark.asyncio
async def test_me_unauthenticated(client: AsyncClient):
    resp = await client.get(ME_URL)
    assert resp.status_code == 403
