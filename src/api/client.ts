// BI_CLIENT_SCAFFOLD_v1
import { ENV } from "@/env";
import { clearToken, getCachedToken } from "@/auth/token";

export class ApiError extends Error {
  status: number;
  code: string;
  constructor(status: number, code: string, message?: string) {
    super(message ?? code);
    this.status = status;
    this.code = code;
  }
}

// bi-server's applicant token lasts one hour. A 401 therefore means "expired"
// far more often than "tampered with", so the token is dropped and the caller
// is expected to send the applicant back to sign-in rather than retry.
export async function apiRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = getCachedToken();
  const headers = new Headers(init.headers ?? {});
  if (token) headers.set("Authorization", `Bearer ${token}`);
  if (init.body && !(init.body instanceof FormData)) {
    headers.set("Content-Type", "application/json");
  }

  const res = await fetch(`${ENV.API_BASE}${ENV.API_PREFIX}${path}`, { ...init, headers });
  const text = await res.text();
  const parsed = text ? JSON.parse(text) : {};

  if (res.status === 401) {
    await clearToken();
    throw new ApiError(401, String(parsed?.error ?? "unauthorized"));
  }
  if (!res.ok) {
    throw new ApiError(res.status, String(parsed?.error ?? `request_failed_${res.status}`), parsed?.detail);
  }
  return parsed as T;
}

export const api = {
  get: <T>(path: string) => apiRequest<T>(path),
  post: <T>(path: string, body?: unknown) =>
    apiRequest<T>(path, {
      method: "POST",
      body: body instanceof FormData ? body : JSON.stringify(body ?? {}),
    }),
};
