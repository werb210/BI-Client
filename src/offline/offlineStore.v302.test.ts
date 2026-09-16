// BI_CLIENT_OFFLINE_v302
import { beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { cacheResponse, cachedResponse, clearOfflineData, drainOutbox, enqueueSave, isNetworkError, isQueueable, readOutbox } from "./offlineStore";
import { bannerText } from "./OfflineBanner";

beforeEach(() => { localStorage.clear(); });

describe("what is kept offline", () => {
  it("queues answer, coverage and requirement saves only", () => {
    expect(isQueueable("POST", "/applicants/applications/a1/answers")).toBe(true);
    expect(isQueueable("POST", "/applicants/applications/a1/products")).toBe(true);
    expect(isQueueable("POST", "/applicants/applications/a1/requirements/r1/confirm")).toBe(true);
    expect(isQueueable("POST", "/applicants/applications/a1/submit")).toBe(false);
    expect(isQueueable("POST", "/applicants/otp/verify")).toBe(false);
    expect(isQueueable("GET", "/applicants/applications/a1/answers")).toBe(false);
  });
  it("recognises a dropped connection", () => {
    expect(isNetworkError(new TypeError("Failed to fetch"))).toBe(true);
    expect(isNetworkError(new Error("Load failed"))).toBe(true);
    expect(isNetworkError(new Error("invalid_otp"))).toBe(false);
  });
});

describe("outbox", () => {
  it("keeps only the newest save for the same place, and sends in order", async () => {
    await enqueueSave("/applicants/applications/a1/products", '{"codes":["A"]}');
    await enqueueSave("/applicants/applications/a1/answers", '{"answers":[]}');
    await enqueueSave("/applicants/applications/a1/products", '{"codes":["A","B"]}');
    const items = await readOutbox();
    expect(items.map((i) => i.body)).toEqual(['{"answers":[]}', '{"codes":["A","B"]}']);
    const sent: string[] = [];
    expect(await drainOutbox(async (i) => { sent.push(i.path); })).toEqual({ sent: 2, left: 0 });
    expect(sent).toEqual(["/applicants/applications/a1/answers", "/applicants/applications/a1/products"]);
  });
  it("stops while still offline and drops a save the server rejects", async () => {
    await enqueueSave("/applicants/applications/a1/answers", "{}");
    await enqueueSave("/applicants/applications/a1/products", "{}");
    expect(await drainOutbox(async () => { throw new TypeError("Failed to fetch"); })).toEqual({ sent: 0, left: 2 });
    const send = vi.fn().mockRejectedValueOnce(Object.assign(new Error("bad"), { status: 400 })).mockResolvedValueOnce(undefined);
    expect(await drainOutbox(send)).toEqual({ sent: 1, left: 0 });
  });
});

describe("read cache", () => {
  it("returns the last copy and clears everything on sign-out", async () => {
    await cacheResponse("/applicants/me/progress", { progress: { headline: "x" } });
    expect(await cachedResponse("/applicants/me/progress")).toEqual({ progress: { headline: "x" } });
    await enqueueSave("/applicants/applications/a1/answers", "{}");
    await clearOfflineData();
    expect(await cachedResponse("/applicants/me/progress")).toBeUndefined();
    expect(await readOutbox()).toEqual([]);
  });
});

describe("banner and wiring", () => {
  it("explains offline and waiting changes", () => {
    expect(bannerText(false, 2)).toBe("You're offline. 2 changes are saved on this phone and will send when you reconnect.");
    expect(bannerText(true, 1)).toBe("Sending 1 saved change…");
    expect(bannerText(true, 0)).toBeNull();
  });
  it("is wired into the API client, app, pages and sign-out", () => {
    const src = join(__dirname, "..");
    const read = (p: string) => readFileSync(join(src, p), "utf8");
    expect(read("api/client.ts")).toContain("throw new OfflineQueuedError();");
    expect(read("App.tsx")).toContain("<OfflineBanner />");
    expect(read("pages/QuestionsPage.tsx")).toContain("err instanceof OfflineQueuedError");
    expect(read("pages/ReviewPage.tsx")).toContain('err.code === "offline"');
    expect(read("auth/token.ts")).toContain("clearOfflineData()");
  });
});
