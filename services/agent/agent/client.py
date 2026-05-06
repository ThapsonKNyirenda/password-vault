import httpx

from .config import AgentSettings


class VaultClient:
    def __init__(self, settings: AgentSettings) -> None:
        if not settings.agent_token:
            raise ValueError("AGENT_TOKEN must be configured for local agent authentication")

        self._client = httpx.Client(
            base_url=settings.vault_url.rstrip("/"),
            timeout=httpx.Timeout(30.0),
            verify=settings.verify_tls,
            headers={"Authorization": f"Bearer {settings.agent_token}"},
        )

    def list_assigned_credentials(self) -> list[dict[str, object]]:
        response = self._client.get("/api/v1/agent/credentials")
        response.raise_for_status()
        return response.json()

    def sync_credential(self, credential_id: str, password: str) -> dict[str, object]:
        response = self._client.post(
            f"/api/v1/agent/credentials/{credential_id}/sync",
            json={"password": password},
        )
        response.raise_for_status()
        return response.json()

    def reveal_credential(self, credential_id: str) -> dict[str, object]:
        response = self._client.get(f"/api/v1/agent/credentials/{credential_id}/reveal")
        response.raise_for_status()
        return response.json()

    def close(self) -> None:
        self._client.close()
