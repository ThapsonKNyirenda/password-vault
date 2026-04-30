from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field

from .models import AccessStatus, ServerOS, SyncSource, UserRole


class LoginRequest(BaseModel):
    username: str
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    username: str
    role: UserRole


class UserCreate(BaseModel):
    username: str
    password: str = Field(min_length=12)
    role: UserRole


class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    username: str
    role: UserRole
    active: bool
    created_at: datetime


class AgentCreateRequest(BaseModel):
    name: str
    site: str


class AgentOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    name: str
    site: str
    active: bool
    last_seen_at: datetime | None
    created_at: datetime


class AgentCreateResponse(BaseModel):
    agent: AgentOut
    api_token: str


class TargetServerCreate(BaseModel):
    name: str
    site: str
    agent_id: str
    os_type: ServerOS
    host: str
    port: int
    managed_account: str
    connection_username: str
    connection_profile: str = "default"


class TargetServerOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    name: str
    site: str
    agent_id: str
    os_type: ServerOS
    host: str
    port: int
    managed_account: str
    connection_username: str
    connection_profile: str
    created_at: datetime


class CredentialCreate(BaseModel):
    server_id: str
    managed_account: str
    initial_password: str = Field(min_length=5)


class CredentialPasswordUpdateRequest(BaseModel):
    password: str = Field(min_length=5)


class CredentialOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    server_id: str
    managed_account: str
    version: int
    last_synced_at: datetime
    last_sync_source: SyncSource


class AccessRequestCreate(BaseModel):
    credential_id: str
    reason: str = Field(min_length=5, max_length=2000)


class AccessDecisionRequest(BaseModel):
    expires_minutes: int = Field(default=15, ge=5, le=120)
    note: str | None = Field(default=None, max_length=400)


class AccessRequestOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    requester_id: int
    credential_id: str
    status: AccessStatus
    reason: str
    expires_at: datetime | None
    approved_by: int | None
    approved_at: datetime | None
    revealed_at: datetime | None
    created_at: datetime


class CredentialCatalogItem(BaseModel):
    credential_id: str
    server_name: str
    site: str
    managed_account: str
    os_type: ServerOS
    version: int
    last_synced_at: datetime
    last_sync_source: SyncSource


class RevealCredentialResponse(BaseModel):
    credential_id: str
    server_name: str
    managed_account: str
    expires_at: datetime | None
    password: str


class AgentCredentialAssignment(BaseModel):
    credential_id: str
    server_id: str
    server_name: str
    site: str
    managed_account: str
    version: int
    last_synced_at: datetime
    last_sync_source: SyncSource


class AgentCredentialSyncRequest(BaseModel):
    password: str = Field(min_length=1)


class AgentAccountSyncRequest(BaseModel):
    server_name: str
    managed_account: str
    password: str = Field(min_length=1)


class AgentCredentialSyncResponse(BaseModel):
    credential_id: str
    changed: bool
    version: int
    last_synced_at: datetime
    last_sync_source: SyncSource


class AuditLogOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    actor_type: str
    actor_id: str
    action: str
    resource_type: str
    resource_id: str
    details: dict[str, object]
    created_at: datetime
