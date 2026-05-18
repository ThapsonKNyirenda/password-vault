export type UserRole = "admin" | "engineer";
export type ServerOS = "unix" | "windows";
export type SyncSource = "admin" | "agent";

export interface AuthResponse {
  access_token: string;
  token_type: "bearer";
  username: string;
  role: UserRole;
}

export interface CredentialCatalogItem {
  credential_id: string;
  server_name: string;
  site: string;
  managed_account: string;
  os_type: ServerOS;
  version: number;
  last_synced_at: string;
  last_sync_source: SyncSource;
}

export interface AccessRequest {
  id: string;
  requester_id: number;
  credential_id: string;
  status: "pending" | "approved" | "denied" | "fulfilled" | "expired";
  reason: string;
  expires_at: string | null;
  approved_by: number | null;
  approved_at: string | null;
  revealed_at: string | null;
  created_at: string;
}

export interface RevealCredentialResponse {
  credential_id: string;
  server_name: string;
  managed_account: string;
  expires_at: string | null;
  password: string;
}

export interface CredentialSshStatusResponse {
  credential_id: string;
  server_name: string;
  host: string;
  port: number;
  managed_account: string;
  ok: boolean;
  status: string;
  message: string;
  checked_at: string;
}

export interface RevealPolicy {
  minutes: number;
}

export interface Agent {
  id: string;
  name: string;
  site: string;
  active: boolean;
  last_seen_at: string | null;
  created_at: string;
}

export interface TargetServer {
  id: string;
  name: string;
  site: string;
  agent_id: string;
  os_type: ServerOS;
  host: string;
  port: number;
  connection_profile: string;
  created_at: string;
}

export interface Credential {
  id: string;
  server_id: string;
  managed_account: string;
  version: number;
  last_synced_at: string;
  last_sync_source: SyncSource;
}

export interface AgentCreateResponse {
  agent: Agent;
  api_token: string;
}

export interface AgentUpdatePayload {
  name?: string;
  site?: string;
  active?: boolean;
}

export interface TargetServerUpdatePayload {
  name?: string;
  site?: string;
  agent_id?: string;
  os_type?: ServerOS;
  host?: string;
  port?: number;
  connection_profile?: string;
}

export interface CredentialUpdatePayload {
  server_id?: string;
  managed_account?: string;
  password?: string;
}

export interface User {
  id: number;
  username: string;
  role: UserRole;
  active: boolean;
  created_at: string;
}

export interface UserUpdatePayload {
  username?: string;
  role?: UserRole;
  password?: string;
}

export interface AuditLog {
  id: number;
  actor_type: string;
  actor_id: string;
  action: string;
  resource_type: string;
  resource_id: string;
  details: Record<string, unknown>;
  created_at: string;
}
