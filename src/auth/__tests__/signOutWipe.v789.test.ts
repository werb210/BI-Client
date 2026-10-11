// BI_CLIENT_v789_SIGN_OUT_WIPE
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const calls: string[] = [];
const store = new Map<string, string>();
let native = true;

vi.mock("@capacitor/core", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  Capacitor: {
    isNativePlatform: () => native,
    getPlatform: () => (native ? "ios" : "web"),
    isPluginAvailable: () => false,
    convertFileSrc: (p: string) => p,
  },
  // Every Capacitor package resolves to the same test mock module, so one
  // vi.mock supplies both Capacitor and Preferences.
  Preferences: {
    get: async ({ key }: { key: string }) => ({ value: store.get(key) ?? null }),
    set: async ({ key, value }: { key: string; value: string }) => { store.set(key, value); },
    remove: async ({ key }: { key: string }) => { store.delete(key); },
    keys: async () => ({ keys: [...store.keys()] }),
    clear: async () => { calls.push("preferences.clear"); store.clear(); },
  },
}));
vi.mock("@/native/clientWidget", () => ({ clearClientWidget: async () => { calls.push("widget.clear"); } }));
vi.mock("@/native/appBadge", () => ({ clearAppBadge: async () => { calls.push("badge.clear"); } }));
vi.mock("@/native/backgroundSync", () => ({ cancelBackgroundSync: async () => { calls.push("background.cancel"); } }));

import { signOutWipe, unregisterPushToken, UNREGISTER_PUSH_PATH } from "../signOutWipe";
import { clearToken, getCachedToken, setToken } from "../token";
import { enqueue, readQueue } from "@/upload/queue";
import { cacheResponse, cachedResponse, enqueueSave, readOutbox } from "@/offline/offlineStore";
import { loadDraft, saveDraft } from "@/entry/draft";
import { rememberPushDeviceToken, registeredPushDeviceToken } from "@/native/pushNotifications";
import { ENV } from "@/env";

const upload = { id: "u1", documentType: "subcontract", filename: "c.pdf", mimeType: "application/pdf", dataUrl: "data:,x", applicantId: "app-1" };

function okFetch() {
  return vi.fn(async (url: string, init?: RequestInit) => {
    calls.push(`fetch ${init?.method} ${url}`);
    return new Response("{}", { status: 200 });
  });
}

beforeEach(() => {
  calls.length = 0;
  store.clear();
  localStorage.clear();
  native = true;
});
afterEach(() => vi.unstubAllGlobals());

describe("sign-out wipe", () => {
  it("unregisters this phone's push token on BI-Server under /api/v1, with the applicant's token", async () => {
    const fetchMock = okFetch();
    vi.stubGlobal("fetch", fetchMock);
    await rememberPushDeviceToken("apns-device-1");
    expect(await unregisterPushToken("session-jwt")).toBe(true);
    const [url, init] = fetchMock.mock.calls[0];
    expect(UNREGISTER_PUSH_PATH).toBe("/client/push/unregister-token");
    expect(url).toBe(`${ENV.API_BASE}/api/v1/client/push/unregister-token`);
    expect(init?.method).toBe("POST");
    expect(new Headers(init?.headers).get("Authorization")).toBe("Bearer session-jwt");
    expect(JSON.parse(String(init?.body))).toEqual({ token: "apns-device-1", platform: "ios" });
  });

  it("does not call the server without a session or outside the app", async () => {
    const fetchMock = okFetch();
    vi.stubGlobal("fetch", fetchMock);
    expect(await unregisterPushToken(null)).toBe(false);
    native = false;
    expect(await unregisterPushToken("session-jwt")).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("a failed or unreachable unregister never blocks the rest of the wipe", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => { throw new TypeError("Failed to fetch"); }));
    await enqueue(upload);
    await signOutWipe("session-jwt");
    expect(await readQueue()).toEqual([]);
    expect(calls).toContain("preferences.clear");
  });

  it("clears the upload queue, offline copies and outbox, Preferences, draft, widget, badge and push token", async () => {
    vi.stubGlobal("fetch", okFetch());
    await rememberPushDeviceToken("apns-device-1");
    await enqueue(upload);
    await cacheResponse("/applicants/me/progress", { progress: { headline: "x" } });
    await enqueueSave("/applicants/applications/a1/answers", "{}");
    saveDraft({ businessName: "Acme", applicantName: "Pat" });
    store.set("some_other_preference", "1");

    await signOutWipe("session-jwt");

    expect(await readQueue()).toEqual([]);
    expect(await cachedResponse("/applicants/me/progress")).toBeUndefined();
    expect(await readOutbox()).toEqual([]);
    expect(loadDraft({ businessName: "", applicantName: "" })).toEqual({ businessName: "", applicantName: "" });
    expect(store.size).toBe(0);
    expect(await registeredPushDeviceToken()).toBeNull();
    expect(calls).toEqual(expect.arrayContaining(["widget.clear", "badge.clear", "background.cancel", "preferences.clear"]));
  });

  it("unregisters push before anything is cleared", async () => {
    vi.stubGlobal("fetch", okFetch());
    await signOutWipe("session-jwt");
    expect(calls[0]).toMatch(/^fetch POST .*\/client\/push\/unregister-token$/);
  });

  it("clearToken (sign-out) runs the wipe while the token is still set, then clears the token", async () => {
    let tokenDuringUnregister: string | null | undefined;
    vi.stubGlobal("fetch", vi.fn(async (_url: string, init?: RequestInit) => {
      tokenDuringUnregister = getCachedToken();
      calls.push(`auth ${new Headers(init?.headers).get("Authorization")}`);
      return new Response("{}", { status: 200 });
    }));
    await setToken("session-jwt");
    await enqueue(upload);
    await clearToken();
    expect(tokenDuringUnregister).toBe("session-jwt");
    expect(calls).toContain("auth Bearer session-jwt");
    expect(getCachedToken()).toBeNull();
    expect(await readQueue()).toEqual([]);
  });
});
