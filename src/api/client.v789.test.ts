// BI_CLIENT_v789 - API client: server message, expired session, minimal offline copies.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const expireSession = vi.fn(async () => undefined);
const clearToken = vi.fn(async () => undefined);
vi.mock("@/auth/token", () => ({ getCachedToken: () => "jwt", expireSession: () => expireSession(), clearToken: () => clearToken() }));

import { ApiError, apiRequest } from "./client";
import { cachedResponse, isCacheable } from "@/offline/offlineStore";

const respond = (status: number, body: unknown) => vi.fn(async () => new Response(JSON.stringify(body), { status }));

beforeEach(() => { localStorage.clear(); expireSession.mockClear(); clearToken.mockClear(); });
afterEach(() => vi.unstubAllGlobals());

describe("errors", () => {
  it("carries the server's message field", async () => {
    vi.stubGlobal("fetch", respond(400, { error: "otp_phone_daily_limit", message: "Daily limit reached." }));
    const err = await apiRequest<never>("/applicants/otp/start", { method: "POST", body: "{}" }).catch((e: unknown) => e as ApiError);
    expect(err).toBeInstanceOf(ApiError);
    expect(err.code).toBe("otp_phone_daily_limit");
    expect(err.serverMessage).toBe("Daily limit reached.");
  });

  it("has no server message when the body has none", async () => {
    vi.stubGlobal("fetch", respond(503, { error: "otp_busy" }));
    const err = await apiRequest<never>("/applicants/otp/start", { method: "POST", body: "{}" }).catch((e: unknown) => e as ApiError);
    expect(err.code).toBe("otp_busy");
    expect(err.serverMessage).toBeUndefined();
  });

  it("a 401 ends the session without the sign-out wipe", async () => {
    vi.stubGlobal("fetch", respond(401, { error: "unauthorized" }));
    await expect(apiRequest("/applicants/me/progress")).rejects.toMatchObject({ status: 401 });
    expect(expireSession).toHaveBeenCalledOnce();
    expect(clearToken).not.toHaveBeenCalled();
  });
});

describe("offline copies are kept only for the screens that show one", () => {
  it("whitelists screen data and leaves messages out", () => {
    expect(isCacheable("/applicants/me/progress")).toBe(true);
    expect(isCacheable("/applicants/action-center/a1")).toBe(true);
    expect(isCacheable("/applicants/applications/a1/questions")).toBe(true);
    expect(isCacheable("/applicants/applications/a1/summary")).toBe(true);
    expect(isCacheable("/applicants/products?country=CA")).toBe(true);
    expect(isCacheable("/applicants/messages")).toBe(false);
    expect(isCacheable("/applicants/messages/unread-count")).toBe(false);
  });

  it("caches a screen GET sealed, and never a messages GET", async () => {
    vi.stubGlobal("fetch", respond(200, { progress: { headline: "Pat Applicant" } }));
    await apiRequest("/applicants/me/progress");
    vi.stubGlobal("fetch", respond(200, { messages: [{ body: "private note" }] }));
    await apiRequest("/applicants/messages");
    await new Promise((r) => setTimeout(r, 20));
    const stored = Object.keys(localStorage).map((k) => localStorage.getItem(k)).join("|");
    expect(stored).not.toContain("Pat Applicant");
    expect(stored).not.toContain("private note");
    expect(await cachedResponse("/applicants/me/progress")).toEqual({ progress: { headline: "Pat Applicant" } });
    expect(await cachedResponse("/applicants/messages")).toBeUndefined();
  });
});
