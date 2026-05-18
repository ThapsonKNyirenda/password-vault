import { clearSession } from "./auth";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000/api/v1";

interface RequestOptions extends Omit<RequestInit, "headers"> {
  token?: string;
  headers?: Record<string, string>;
}

export class ApiError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

function normalizeErrorDetail(detail: unknown): string | null {
  if (typeof detail === "string" && detail.trim().length > 0) {
    return detail;
  }

  if (Array.isArray(detail)) {
    const messages = detail
      .map((item) => {
        if (typeof item !== "object" || item === null) {
          return null;
        }

        const record = item as { loc?: unknown; msg?: unknown };
        const msg = typeof record.msg === "string" ? record.msg : null;
        const loc = Array.isArray(record.loc)
          ? record.loc
              .filter((part) => typeof part === "string" || typeof part === "number")
              .map((part) => String(part))
              .join(".")
          : null;

        if (msg && loc) {
          return `${loc}: ${msg}`;
        }
        return msg;
      })
      .filter((entry): entry is string => Boolean(entry));

    if (messages.length > 0) {
      return messages.join("; ");
    }
  }

  return null;
}

function redirectExpiredSession(path: string): void {
  if (typeof window === "undefined" || path === "/auth/login") {
    return;
  }

  clearSession();
  if (window.location.pathname !== "/login") {
    window.location.replace("/login");
  }
}

export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const url = `${API_BASE_URL}${path}`;
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers ?? {}),
  };

  if (options.token) {
    headers.Authorization = `Bearer ${options.token}`;
  }

  console.log(`API Request: ${options.method || 'GET'} ${url}`);
  
  const response = await fetch(url, {
    ...options,
    headers,
  });

  console.log(`API Response: ${response.status} ${response.statusText}`);

  if (response.status === 204) {
    return null as T;
  }

  let payload: unknown = null;
  try {
    payload = await response.json();
  } catch {
    payload = null;
  }

  if (!response.ok) {
    if (response.status === 401) {
      redirectExpiredSession(path);
    }

    const detail = typeof payload === "object" && payload !== null && "detail" in payload
      ? (payload as { detail: unknown }).detail
      : null;
    const message = normalizeErrorDetail(detail) ?? `Request failed with status ${response.status}`;
    throw new ApiError(message, response.status);
  }

  return payload as T;
}

export { API_BASE_URL };
