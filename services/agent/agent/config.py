from functools import lru_cache

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class AgentSettings(BaseSettings):
    agent_name: str = Field(default="site-a-agent-1", alias="AGENT_NAME")
    agent_site: str = Field(default="site-a", alias="AGENT_SITE")
    agent_token: str = Field(default="", alias="AGENT_TOKEN")

    vault_url: str = Field(default="http://localhost:8000", alias="AGENT_VAULT_URL")
    poll_interval_seconds: int = Field(default=10, alias="AGENT_POLL_INTERVAL_SECONDS")
    verify_tls: bool = Field(default=False, alias="AGENT_VERIFY_TLS")
    password_source_file: str = Field(default="/data/passwords.json", alias="AGENT_PASSWORD_SOURCE_FILE")
    agent_unix_ssh_key_path: str = Field(default="/keys/id_ed25519", alias="AGENT_UNIX_SSH_KEY_PATH")

    model_config = SettingsConfigDict(
        env_file=".env",
        case_sensitive=False,
        extra="ignore",
    )


@lru_cache
def get_settings() -> AgentSettings:
    return AgentSettings()
