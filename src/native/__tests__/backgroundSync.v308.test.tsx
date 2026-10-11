// BI_CLIENT_BACKGROUND_SYNC_v308
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { cleanup, render, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

const plugin = vi.hoisted(() => ({ enqueue: vi.fn(async (_o: Record<string, unknown>) => undefined), results: vi.fn(), acknowledge: vi.fn(async () => undefined), cancelAll: vi.fn(async () => undefined) }));
const state = vi.hoisted(() => ({ uploads: [] as any[], saves: [] as any[] }));
const nat = vi.hoisted(() => ({ on: true }));
const appListeners = vi.hoisted(() => ({} as Record<string, (event: any) => void>));
const stores = vi.hoisted(() => ({ prefs: new Map<string, string>(), secure: new Map<string, string>() }));

// Every Capacitor package is one module in tests, so all overrides live in
// this one mock: the platform, the BackgroundSync plugin, the App lifecycle
// listeners and in-memory Preferences / SecureStorage.
vi.mock("@capacitor/core", async (importOriginal) => {
  const orig = await importOriginal<typeof import("@/test-capacitor-mock")>();
  return {
    ...orig,
    Capacitor: { ...orig.Capacitor, isNativePlatform: () => nat.on, isPluginAvailable: (name: string) => nat.on && name === "BackgroundSync" },
    registerPlugin: (name: string) => (name === "BackgroundSync" ? plugin : {}),
    App: {
      addListener: vi.fn(async (name: string, cb: (event: any) => void) => { appListeners[name] = cb; return { remove: async () => undefined }; }),
      getLaunchUrl: async () => undefined,
      exitApp: async () => undefined,
    },
    Preferences: {
      get: async ({ key }: { key: string }) => ({ value: stores.prefs.get(key) ?? null }),
      set: async ({ key, value }: { key: string; value: string }) => { stores.prefs.set(key, value); },
      remove: async ({ key }: { key: string }) => { stores.prefs.delete(key); },
      clear: async () => { stores.prefs.clear(); },
      keys: async () => ({ keys: [...stores.prefs.keys()] }),
    },
    SecureStorage: {
      get: async (key: string) => stores.secure.get(key) ?? null,
      set: async (key: string, value: string) => { stores.secure.set(key, value); },
      remove: async (key: string) => { stores.secure.delete(key); },
    },
  };
});
vi.mock("@/env", () => ({ ENV: { API_BASE: "https://bi", API_PREFIX: "/api/v1" } }));
vi.mock("@/native/deviceSignIn", () => ({ refreshSessionForBackground: async () => "fresh-token" }));
vi.mock("@/upload/queue", () => ({
  readQueue: async () => state.uploads.map((u) => ({ ...u })),
  dequeue: async (id: string) => { state.uploads = state.uploads.filter((u) => u.id !== id); },
  setUploadHanded: async (id: string, handedAt: number | undefined) => { state.uploads = state.uploads.map((u) => (u.id === id ? { ...u, handedAt } : u)); },
  clearQueue: async () => { state.uploads = []; },
}));
vi.mock("@/offline/offlineStore", () => ({
  readOutbox: async () => state.saves.map((s) => ({ ...s })),
  removeOutboxItem: async (id: string) => { state.saves = state.saves.filter((s) => s.id !== id); },
  setOutboxHanded: async (id: string, handedAt: number | undefined) => { state.saves = state.saves.map((s) => (s.id === id ? { ...s, handedAt } : s)); },
  clearOfflineData: async () => { state.saves = []; },
}));

import { handOffToBackground, multipartBody, outcomeFor, reconcileBackground } from "../backgroundSync";
import { clearToken, expireSession, setToken } from "@/auth/token";
import NativeBridge from "@/native/NativeBridge";

/** An unsigned JWT whose subject is the applicant. */
const jwtFor = (sub: string) => `h.${btoa(JSON.stringify({ sub })).replace(/=+$/, "")}.s`;
const upload = (id: string, applicantId: string) => ({ id, filename: "sub.pdf", mimeType: "application/pdf", dataUrl: "data:application/pdf;base64," + btoa("x"), attempts: 0, queuedAt: 1, documentType: "contract", applicantId });

beforeEach(async () => {
  nat.on = true;
  state.uploads = []; state.saves = [];
  plugin.enqueue.mockClear(); plugin.results.mockReset(); plugin.acknowledge.mockClear(); plugin.cancelAll.mockClear();
  stores.prefs.clear(); stores.secure.clear(); localStorage.clear();
  for (const k of Object.keys(appListeners)) delete appListeners[k];
  await setToken(jwtFor("applicant-1"));
});
afterEach(() => cleanup());

describe("BI background sync", () => {
  it("builds a valid multipart body for the contract", () => {
    const { contentType, bodyBase64 } = multipartBody({ name: "sub.pdf", type: "application/pdf", base64: btoa("PDF") }, "B1");
    expect(contentType).toBe("multipart/form-data; boundary=B1");
    const text = atob(bodyBase64);
    expect(text).toContain('name="file"; filename="sub.pdf"');
    expect(text).toContain("\r\n\r\nPDF\r\n--B1--");
  });

  it("hands uploads and saves to the phone with a fresh session", async () => {
    state.uploads = [upload("u1", "applicant-1")];
    state.saves = [{ id: "s1", path: "/applicants/applications/a1/answers", body: '{"answers":[]}', queuedAt: 1, attempts: 0 }];
    expect(await handOffToBackground()).toBe(2);
    expect(plugin.enqueue).toHaveBeenCalledWith(expect.objectContaining({ id: "bi-upload-u1", url: "https://bi/api/v1/applicants/contract/upload", headers: { Authorization: "Bearer fresh-token" } }));
    expect(plugin.enqueue).toHaveBeenCalledWith(expect.objectContaining({ id: "bi-save-s1", url: "https://bi/api/v1/applicants/applications/a1/answers", contentType: "application/json" }));
    expect(state.uploads[0].handedAt).toBeTruthy();
    expect(state.saves[0].handedAt).toBeTruthy();
    expect(await handOffToBackground()).toBe(0);
  });

  it("hands over only the signed-in applicant's uploads", async () => {
    state.uploads = [upload("mine", "applicant-1"), upload("theirs", "applicant-2")];
    expect(await handOffToBackground()).toBe(1);
    expect(plugin.enqueue).toHaveBeenCalledTimes(1);
    expect(plugin.enqueue).toHaveBeenCalledWith(expect.objectContaining({ id: "bi-upload-mine" }));
    expect(state.uploads.find((u) => u.id === "theirs").handedAt).toBeUndefined();
  });

  it("clears sent items and returns expired-session sends to the app", async () => {
    state.uploads = [{ id: "u1", handedAt: 1 }];
    state.saves = [{ id: "s1", handedAt: 1 }];
    plugin.results.mockResolvedValue({ results: [{ id: "bi-upload-u1", status: 201 }, { id: "bi-save-s1", status: 401 }] });
    expect(await reconcileBackground()).toEqual({ sent: 1, refused: 0, retry: 1 });
    expect(state.uploads).toEqual([]);
    expect(state.saves[0].handedAt).toBeUndefined();
    expect(outcomeFor(422)).toBe("refused");
  });
});

describe("BI background sync wiring", () => {
  it("leaving the app hands pending sends to the phone; coming back reads the results", async () => {
    state.uploads = [upload("u1", "applicant-1")];
    render(<MemoryRouter><NativeBridge /></MemoryRouter>);
    await waitFor(() => expect(appListeners.appStateChange).toBeTypeOf("function"));
    await waitFor(() => expect(appListeners.resume).toBeTypeOf("function"));

    appListeners.appStateChange({ isActive: true });
    await new Promise((r) => setTimeout(r, 0));
    expect(plugin.enqueue).not.toHaveBeenCalled();

    appListeners.appStateChange({ isActive: false });
    await waitFor(() => expect(plugin.enqueue).toHaveBeenCalledWith(expect.objectContaining({ id: "bi-upload-u1" })));
    await waitFor(() => expect(state.uploads[0].handedAt).toBeTruthy());

    plugin.results.mockResolvedValue({ results: [{ id: "bi-upload-u1", status: 201 }] });
    appListeners.resume({});
    await waitFor(() => expect(state.uploads).toEqual([]));
    expect(plugin.acknowledge).toHaveBeenCalledWith({ ids: ["bi-upload-u1"] });
  });

  it("the in-app upload queue skips files the phone is already sending", async () => {
    const queue = await vi.importActual<typeof import("@/upload/queue")>("@/upload/queue");
    await queue.enqueue({ id: "q1", documentType: "contract", filename: "a.pdf", mimeType: "application/pdf", dataUrl: "data:,a", applicantId: "applicant-1" });
    await queue.enqueue({ id: "q2", documentType: "contract", filename: "b.pdf", mimeType: "application/pdf", dataUrl: "data:,b", applicantId: "applicant-1" });
    await queue.setUploadHanded("q1", 123);
    const send = vi.fn(async () => undefined);
    expect(await queue.drain(send, "applicant-1")).toEqual({ sent: 1, failed: 0, dropped: 0 });
    expect(send).toHaveBeenCalledTimes(1);
    expect(send).toHaveBeenCalledWith(expect.objectContaining({ id: "q2" }));
    expect((await queue.readQueue()).map((q) => q.id)).toEqual(["q1"]);
  });

  it("the offline outbox skips saves the phone is already sending", async () => {
    const store = await vi.importActual<typeof import("@/offline/offlineStore")>("@/offline/offlineStore");
    await store.enqueueSave("/applicants/applications/a1/answers", '{"answers":[1]}');
    await store.enqueueSave("/applicants/applications/a1/products", '{"codes":[]}');
    const [first] = await store.readOutbox();
    await store.setOutboxHanded(first.id, 123);
    const send = vi.fn(async () => undefined);
    expect(await store.drainOutbox(send)).toEqual({ sent: 1, left: 1 });
    expect(send).toHaveBeenCalledTimes(1);
    expect(send).toHaveBeenCalledWith(expect.objectContaining({ path: "/applicants/applications/a1/products" }));
    expect((await store.readOutbox()).map((i) => i.id)).toEqual([first.id]);
  });

  it("sign-out cancels anything the phone was still sending", async () => {
    await clearToken();
    await waitFor(() => expect(plugin.cancelAll).toHaveBeenCalled());
  });

  it("an expired session (401) also cancels background sends", async () => {
    await expireSession();
    await waitFor(() => expect(plugin.cancelAll).toHaveBeenCalled());
  });

  it("both phones register the plugin and iOS resumes background sessions", () => {
    expect(readFileSync("ios/App/App/AppDelegate.swift", "utf8")).toContain("handleEventsForBackgroundURLSession");
    expect(readFileSync("ios/App/App/DocumentScannerPlugin.swift", "utf8")).toContain("registerPluginInstance(BackgroundSyncPlugin())");
    expect(readFileSync("android/app/src/main/java/com/boreal/risk/client/MainActivity.java", "utf8")).toContain("registerPlugin(BackgroundSyncPlugin.class)");
  });
});
