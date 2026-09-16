// BI_CLIENT_BACKGROUND_SYNC_v308
import { beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const plugin = vi.hoisted(() => ({ enqueue: vi.fn(async () => undefined), results: vi.fn(), acknowledge: vi.fn(async () => undefined), cancelAll: vi.fn(async () => undefined) }));
const state = vi.hoisted(() => ({ uploads: [] as any[], saves: [] as any[] }));

vi.mock("@capacitor/core", () => ({ Capacitor: { isNativePlatform: () => true, isPluginAvailable: () => true }, registerPlugin: () => plugin }));
vi.mock("@/env", () => ({ ENV: { API_BASE: "https://bi", API_PREFIX: "/api/v1" } }));
vi.mock("@/native/deviceSignIn", () => ({ refreshSessionForBackground: async () => "fresh-token" }));
vi.mock("@/upload/queue", () => ({
  readQueue: async () => state.uploads.map((u) => ({ ...u })),
  dequeue: async (id: string) => { state.uploads = state.uploads.filter((u) => u.id !== id); },
  setUploadHanded: async (id: string, handedAt: number | undefined) => { state.uploads = state.uploads.map((u) => (u.id === id ? { ...u, handedAt } : u)); },
}));
vi.mock("@/offline/offlineStore", () => ({
  readOutbox: async () => state.saves.map((s) => ({ ...s })),
  removeOutboxItem: async (id: string) => { state.saves = state.saves.filter((s) => s.id !== id); },
  setOutboxHanded: async (id: string, handedAt: number | undefined) => { state.saves = state.saves.map((s) => (s.id === id ? { ...s, handedAt } : s)); },
}));

import { handOffToBackground, multipartBody, outcomeFor, reconcileBackground } from "../backgroundSync";

beforeEach(() => { state.uploads = []; state.saves = []; plugin.enqueue.mockClear(); plugin.results.mockReset(); });

describe("BI background sync", () => {
  it("builds a valid multipart body for the contract", () => {
    const { contentType, bodyBase64 } = multipartBody({ name: "sub.pdf", type: "application/pdf", base64: btoa("PDF") }, "B1");
    expect(contentType).toBe("multipart/form-data; boundary=B1");
    const text = atob(bodyBase64);
    expect(text).toContain('name="file"; filename="sub.pdf"');
    expect(text).toContain("\r\n\r\nPDF\r\n--B1--");
  });

  it("hands uploads and saves to the phone with a fresh session", async () => {
    state.uploads = [{ id: "u1", filename: "sub.pdf", mimeType: "application/pdf", dataUrl: "data:application/pdf;base64," + btoa("x"), attempts: 0, queuedAt: 1, documentType: "contract" }];
    state.saves = [{ id: "s1", path: "/applicants/applications/a1/answers", body: '{"answers":[]}', queuedAt: 1, attempts: 0 }];
    expect(await handOffToBackground()).toBe(2);
    expect(plugin.enqueue).toHaveBeenCalledWith(expect.objectContaining({ id: "bi-upload-u1", url: "https://bi/api/v1/applicants/contract/upload", headers: { Authorization: "Bearer fresh-token" } }));
    expect(plugin.enqueue).toHaveBeenCalledWith(expect.objectContaining({ id: "bi-save-s1", url: "https://bi/api/v1/applicants/applications/a1/answers", contentType: "application/json" }));
    expect(state.uploads[0].handedAt).toBeTruthy();
    expect(state.saves[0].handedAt).toBeTruthy();
    expect(await handOffToBackground()).toBe(0);
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

  it("is wired to the app lifecycle, queues, sign-out and both phones", () => {
    const src = join(__dirname, "..", "..");
    const root = join(src, "..");
    const read = (p: string) => readFileSync(join(src, p), "utf8");
    expect(read("native/NativeBridge.tsx")).toContain("m.handOffToBackground()");
    expect(read("native/NativeBridge.tsx")).toContain("m.reconcileBackground()");
    expect(read("upload/queue.ts")).toContain("if (item.handedAt) continue;");
    expect(read("offline/offlineStore.ts")).toContain("if (item.handedAt) { index += 1; continue; }");
    expect(read("auth/token.ts")).toContain("cancelBackgroundSync()");
    expect(readFileSync(join(root, "ios/App/App/AppDelegate.swift"), "utf8")).toContain("handleEventsForBackgroundURLSession");
    expect(readFileSync(join(root, "ios/App/App/DocumentScannerPlugin.swift"), "utf8")).toContain("registerPluginInstance(BackgroundSyncPlugin())");
    expect(readFileSync(join(root, "android/app/src/main/java/com/boreal/risk/client/MainActivity.java"), "utf8")).toContain("registerPlugin(BackgroundSyncPlugin.class)");
  });
});
