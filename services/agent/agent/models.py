from datetime import datetime

from pydantic import BaseModel


class AgentCredentialAssignment(BaseModel):
    credential_id: str
    server_id: str
    server_name: str
    site: str
    managed_account: str
    version: int
    last_synced_at: datetime
    last_sync_source: str


class AgentCredentialSyncResponse(BaseModel):
    credential_id: str
    changed: bool
    version: int
    last_synced_at: datetime
    last_sync_source: str
