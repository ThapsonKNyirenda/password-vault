from __future__ import annotations


def login(client, username: str, password: str) -> str:
    response = client.post(
        "/api/v1/auth/login",
        json={"username": username, "password": password},
    )
    assert response.status_code == 200
    return response.json()["access_token"]


def create_agent_server_credential(client, admin_token: str) -> tuple[str, str, str]:
    agent_response = client.post(
        "/api/v1/admin/agents",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={"name": "site-a-agent-2", "site": "site-a"},
    )
    assert agent_response.status_code == 201
    agent_payload = agent_response.json()
    agent_id = agent_payload["agent"]["id"]
    agent_token = agent_payload["api_token"]

    server_response = client.post(
        "/api/v1/admin/servers",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={
            "name": "server-a",
            "site": "site-a",
            "agent_id": agent_id,
            "os_type": "unix",
            "host": "10.0.0.10",
            "port": 22,
            "managed_account": "svc_app",
            "connection_username": "opsadmin",
            "connection_profile": "default",
        },
    )
    assert server_response.status_code == 201
    server_id = server_response.json()["id"]

    credential_response = client.post(
        "/api/v1/admin/credentials",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={
            "server_id": server_id,
            "managed_account": "svc_app",
            "initial_password": "InitialPassword!1",
        },
    )
    assert credential_response.status_code == 201
    credential_id = credential_response.json()["id"]
    return agent_token, server_id, credential_id


def test_create_credential_sets_admin_sync_metadata(client) -> None:
    admin_token = login(client, "admin", "ChangeMeStrong!")
    _, _, credential_id = create_agent_server_credential(client, admin_token)

    response = client.get(
        "/api/v1/admin/credentials",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert response.status_code == 200
    credential = next(item for item in response.json() if item["id"] == credential_id)
    assert credential["version"] == 1
    assert credential["last_sync_source"] == "admin"
    assert credential["last_synced_at"]


def test_direct_reveal_returns_current_password(client) -> None:
    admin_token = login(client, "admin", "ChangeMeStrong!")
    engineer_token = login(client, "engineer", "EngineerChangeMe!123")
    _, _, credential_id = create_agent_server_credential(client, admin_token)

    reveal_response = client.post(
        "/api/v1/access-requests/direct-reveal",
        headers={"Authorization": f"Bearer {engineer_token}"},
        json={"credential_id": credential_id},
    )
    assert reveal_response.status_code == 200
    reveal_payload = reveal_response.json()
    assert reveal_payload["credential_id"] == credential_id
    assert reveal_payload["password"] == "InitialPassword!1"


def test_agent_sync_updates_password_and_increments_version_only_on_change(client) -> None:
    admin_token = login(client, "admin", "ChangeMeStrong!")
    agent_token, _, credential_id = create_agent_server_credential(client, admin_token)

    list_response = client.get(
        "/api/v1/agent/credentials",
        headers={"Authorization": f"Bearer {agent_token}"},
    )
    assert list_response.status_code == 200
    assignments = list_response.json()
    assert len(assignments) == 1
    assert assignments[0]["credential_id"] == credential_id

    sync_response = client.post(
        f"/api/v1/agent/credentials/{credential_id}/sync",
        headers={"Authorization": f"Bearer {agent_token}"},
        json={"password": "UpdatedPassword!2"},
    )
    assert sync_response.status_code == 200
    first_sync = sync_response.json()
    assert first_sync["changed"] is True
    assert first_sync["version"] == 2
    assert first_sync["last_sync_source"] == "agent"

    second_sync_response = client.post(
        f"/api/v1/agent/credentials/{credential_id}/sync",
        headers={"Authorization": f"Bearer {agent_token}"},
        json={"password": "UpdatedPassword!2"},
    )
    assert second_sync_response.status_code == 200
    second_sync = second_sync_response.json()
    assert second_sync["changed"] is False
    assert second_sync["version"] == 2
    assert second_sync["last_sync_source"] == "agent"


def test_unauthorized_calls_are_rejected(client) -> None:
    admin_token = login(client, "admin", "ChangeMeStrong!")
    engineer_token = login(client, "engineer", "EngineerChangeMe!123")
    _, server_id, credential_id = create_agent_server_credential(client, admin_token)

    forbidden_response = client.put(
        f"/api/v1/admin/credentials/{credential_id}/password",
        headers={"Authorization": f"Bearer {engineer_token}"},
        json={"password": "ShouldNotWork!1"},
    )
    assert forbidden_response.status_code == 403

    unauthorized_agent_response = client.get(
        "/api/v1/agent/credentials",
        headers={"Authorization": "Bearer invalid-agent-token"},
    )
    assert unauthorized_agent_response.status_code == 401

    missing_credential_response = client.post(
        f"/api/v1/agent/credentials/{server_id}/sync",
        headers={"Authorization": "Bearer invalid-agent-token"},
        json={"password": "Anything"},
    )
    assert missing_credential_response.status_code == 401
