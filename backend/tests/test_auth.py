"""Authentication API tests."""

import secrets

import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_register_and_login(client: AsyncClient):
    email = f"user_{secrets.token_hex(4)}@example.com"
    register = await client.post(
        "/api/auth/register",
        json={
            "email": email,
            "password": "SecurePass1!",
            "first_name": "Ada",
            "last_name": "Lovelace",
        },
    )
    assert register.status_code == 200, register.text
    body = register.json()
    assert body["user"]["email"] == email
    assert "access_token" in body["tokens"]

    login = await client.post(
        "/api/auth/login",
        json={"email": email, "password": "SecurePass1!"},
    )
    assert login.status_code == 200
    token = login.json()["tokens"]["access_token"]
    me = await client.get("/api/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert me.status_code == 200
    assert me.json()["email"] == email


@pytest.mark.asyncio
async def test_login_invalid_credentials(client: AsyncClient):
    resp = await client.post(
        "/api/auth/login",
        json={"email": "nobody@example.com", "password": "wrong"},
    )
    assert resp.status_code == 401
