from functools import lru_cache

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_name: str = Field(default="central-password-vault", alias="VAULT_APP_NAME")
    env: str = Field(default="development", alias="VAULT_ENV")
    host: str = Field(default="0.0.0.0", alias="VAULT_HOST")
    port: int = Field(default=8000, alias="VAULT_PORT")

    database_url: str = Field(
        default="postgresql+psycopg://postgres:Postgres@localhost:5432/vault",
        alias="DATABASE_URL",
    )
    cors_allowed_origins: str = Field(
        default="http://localhost:3000,http://127.0.0.1:3000",
        alias="CORS_ALLOWED_ORIGINS",
    )
    cors_allowed_origin_regex: str = Field(
        default=r"^https?://(localhost|127\.0\.0\.1|10\.\d{1,3}\.\d{1,3}\.\d{1,3}|192\.168\.\d{1,3}\.\d{1,3}|172\.(1[6-9]|2\d|3[0-1])\.\d{1,3}\.\d{1,3})(:\d+)?$",
        alias="CORS_ALLOWED_ORIGIN_REGEX",
    )

    jwt_secret: str = Field(default="dev-secret-change-me", alias="JWT_SECRET")
    jwt_exp_minutes: int = Field(default=60, alias="JWT_EXP_MINUTES")

    vault_master_key: str = Field(
        default="MDEyMzQ1Njc4OWFiY2RlZjAxMjM0NTY3ODlhYmNkZWY=",
        alias="VAULT_MASTER_KEY",
    )

    default_admin_username: str = Field(default="admin", alias="DEFAULT_ADMIN_USERNAME")
    default_admin_password: str = Field(default="ChangeMeStrong!", alias="DEFAULT_ADMIN_PASSWORD")

    rotation_scan_interval_seconds: int = Field(default=20, alias="ROTATION_SCAN_INTERVAL_SECONDS")
    max_job_attempts: int = Field(default=5, alias="MAX_JOB_ATTEMPTS")

    bootstrap_agent_name: str = Field(default="site-a-agent-1", alias="AGENT_NAME")
    bootstrap_agent_site: str = Field(default="site-a", alias="AGENT_SITE")
    bootstrap_agent_token: str = Field(default="", alias="AGENT_TOKEN")

    model_config = SettingsConfigDict(
        env_file=".env",
        case_sensitive=False,
        extra="ignore",
    )

    @property
    def cors_origins(self) -> list[str]:
        return [item.strip() for item in self.cors_allowed_origins.split(",") if item.strip()]

    @property
    def cors_origin_regex(self) -> str | None:
        value = self.cors_allowed_origin_regex.strip()
        return value or None


@lru_cache
def get_settings() -> Settings:
    return Settings()
