import json

import pytest

from agent.executors import load_password_source
from agent.main import sync_assignments
from agent.models import AgentCredentialAssignment


class FakeClient:
    def __init__(self) -> None:
        self.calls: list[tuple[str, str]] = []

    def sync_credential(self, credential_id: str, password: str) -> dict[str, object]:
        self.calls.append((credential_id, password))
        return {
            "credential_id": credential_id,
            "changed": True,
            "version": 2,
            "last_synced_at": "2026-04-24T00:00:00Z",
            "last_sync_source": "agent",
        }


def test_load_password_source_reads_json_mapping(tmp_path) -> None:
    source_file = tmp_path / "passwords.json"
    source_file.write_text(json.dumps({"cred-1": "Password!1"}), encoding="utf-8")

    assert load_password_source(str(source_file)) == {"cred-1": "Password!1"}


def test_load_password_source_fails_for_missing_or_invalid_file(tmp_path) -> None:
    with pytest.raises(FileNotFoundError):
        load_password_source(str(tmp_path / "missing.json"))

    malformed_file = tmp_path / "bad.json"
    malformed_file.write_text("[]", encoding="utf-8")
    with pytest.raises(ValueError):
        load_password_source(str(malformed_file))


def test_sync_assignments_skips_unchanged_passwords() -> None:
    client = FakeClient()
    assignments = [
        AgentCredentialAssignment(
            credential_id="cred-1",
            server_id="server-1",
            server_name="server-a",
            site="site-a",
            managed_account="svc_app",
            version=1,
            last_synced_at="2026-04-24T00:00:00Z",
            last_sync_source="admin",
        )
    ]
    cache = {"cred-1": "Password!1"}

    sync_assignments(client, assignments, {"cred-1": "Password!1"}, cache)
    assert client.calls == []

    sync_assignments(client, assignments, {"cred-1": "Password!2"}, cache)
    assert client.calls == [("cred-1", "Password!2")]
