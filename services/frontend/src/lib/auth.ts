import type { UserRole } from "@/lib/types";

const TOKEN_KEY = "vault_token";
const ROLE_KEY = "vault_role";
const USERNAME_KEY = "vault_username";

export interface AuthSession {
  token: string;
  role: UserRole;
  username: string;
}

function inBrowser(): boolean {
  return typeof window !== "undefined";
}

export function getSession(): AuthSession | null {
  if (!inBrowser()) {
    return null;
  }

  const token = window.localStorage.getItem(TOKEN_KEY);
  const role = window.localStorage.getItem(ROLE_KEY) as UserRole | null;
  const username = window.localStorage.getItem(USERNAME_KEY);

  if (!token || !role || !username) {
    return null;
  }

  return { token, role, username };
}

export function setSession(session: AuthSession): void {
  if (!inBrowser()) {
    return;
  }
  window.localStorage.setItem(TOKEN_KEY, session.token);
  window.localStorage.setItem(ROLE_KEY, session.role);
  window.localStorage.setItem(USERNAME_KEY, session.username);
}

export function clearSession(): void {
  if (!inBrowser()) {
    return;
  }
  window.localStorage.removeItem(TOKEN_KEY);
  window.localStorage.removeItem(ROLE_KEY);
  window.localStorage.removeItem(USERNAME_KEY);
}
