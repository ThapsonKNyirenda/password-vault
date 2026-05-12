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

function isJwtExpired(token: string): boolean {
  const [, payload] = token.split(".");
  if (!payload) {
    return false;
  }

  try {
    const normalizedPayload = payload.replace(/-/g, "+").replace(/_/g, "/");
    const paddedPayload = normalizedPayload.padEnd(
      normalizedPayload.length + ((4 - (normalizedPayload.length % 4)) % 4),
      "=",
    );
    const decoded = JSON.parse(window.atob(paddedPayload)) as { exp?: unknown };
    if (typeof decoded.exp !== "number") {
      return false;
    }
    return decoded.exp * 1000 <= Date.now();
  } catch {
    return false;
  }
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

  if (isJwtExpired(token)) {
    clearSession();
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
