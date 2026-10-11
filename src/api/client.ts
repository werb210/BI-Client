// BI_CLIENT_SCAFFOLD_v1
import { ENV } from "@/env";
import { expireSession, getCachedToken } from "@/auth/token";
import { cacheResponse, cachedResponse, enqueueSave, isCacheable, isNetworkError, isQueueable, OFFLINE_COPY, OfflineQueuedError } from "@/offline/offlineStore"; // BI_CLIENT_OFFLINE_v302

export class ApiError extends Error {
  status: number;
  code: string;
  /** BI_CLIENT_v789 - the server's own words for the applicant, when it sent any. */
  serverMessage?: string;
  constructor(status: number, code: string, message?: string, serverMessage?: string) {
    super(message ?? code);
    this.status = status;
    this.code = code;
    if (serverMessage) this.serverMessage = serverMessage;
  }
}

// BI_CLIENT_v789 - BI-Server puts a sentence for the applicant in `message`.
function textField(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
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

  // BI_CLIENT_OFFLINE_v302 - no connection: show the last copy of a screen, or keep a save for later.
  const method = String(init.method ?? "GET").toUpperCase();
  const fromOutbox = headers.get("X-Boreal-Outbox") === "1";
  headers.delete("X-Boreal-Outbox");
  let res: Response;
  try {
    res = await fetch(`${ENV.API_BASE}${ENV.API_PREFIX}${path}`, { ...init, headers });
  } catch (err) {
    if (!isNetworkError(err)) throw err;
    if (method === "GET") {
      const cached = await cachedResponse<T>(path);
      if (cached !== undefined) {
        try { window.dispatchEvent(new Event(OFFLINE_COPY)); } catch { /* not in a browser */ }
        return cached;
      }
    } else if (!fromOutbox && isQueueable(method, path) && typeof init.body === "string") {
      await enqueueSave(path, init.body);
      throw new OfflineQueuedError();
    }
    throw new ApiError(0, "offline");
  }
  const text = await res.text();
  const parsed = text ? JSON.parse(text) : {};

  if (res.status === 401) {
    // BI_CLIENT_v789 - an expired session, not a sign-out: queued uploads stay
    // (sealed, tagged with the applicant) for when the same applicant returns.
    await expireSession();
    throw new ApiError(401, String(parsed?.error ?? "unauthorized"), undefined, textField(parsed?.message));
  }
  if (!res.ok) {
    const serverMessage = textField(parsed?.message);
    throw new ApiError(res.status, String(parsed?.error ?? `request_failed_${res.status}`), parsed?.detail, serverMessage);
  }
  // v302; BI_CLIENT_v789 - only the screens that show an offline copy keep one.
  if (method === "GET" && isCacheable(path)) void cacheResponse(path, parsed);
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
