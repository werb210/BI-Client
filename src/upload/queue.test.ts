// BI_CLIENT_BLOCK_v092_CAPTURE_POLISH_v1
import { describe, expect, it, beforeEach, vi } from "vitest";

const store = new Map<string, string>();
// Every Capacitor package resolves to one test mock module, so keep its other exports.
vi.mock("@capacitor/preferences", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  Preferences: {
    get: async ({ key }: { key: string }) => ({ value: store.get(key) ?? null }),
    set: async ({ key, value }: { key: string; value: string }) => { store.set(key, value); },
    remove: async ({ key }: { key: string }) => { store.delete(key); },
  },
}));

import { enqueue, readQueue, dequeue, recordFailure, drain, clearQueue } from "./queue";

const item = { id: "a1", documentType: "contract", filename: "c.pdf", mimeType: "application/pdf", dataUrl: "data:," };

describe("upload queue", () => {
  beforeEach(() => store.clear());

  it("persists and deduplicates", async () => {
    await enqueue(item);
    await enqueue(item);
    expect(await readQueue()).toHaveLength(1);
  });

  it("removes on success", async () => {
    await enqueue(item);
    await dequeue("a1");
    expect(await readQueue()).toHaveLength(0);
  });

  it("abandons after five attempts rather than retrying forever", async () => {
    await enqueue(item);
    for (let i = 0; i < 4; i += 1) expect(await recordFailure("a1")).toBe("retry");
    expect(await recordFailure("a1")).toBe("abandoned");
    expect(await readQueue()).toHaveLength(0);
  });

  it("drains what it can and keeps what it cannot", async () => {
    await enqueue(item);
    await enqueue({ ...item, id: "a2" });
    const result = await drain(async (q) => { if (q.id === "a2") throw new Error("offline"); });
    expect(result).toEqual({ sent: 1, failed: 1, dropped: 0 });
    expect((await readQueue()).map((q) => q.id)).toEqual(["a2"]);
  });

  // BI_CLIENT_v789
  it("sends only the signed-in applicant's uploads and drops everyone else's", async () => {
    await enqueue({ ...item, id: "mine", applicantId: "app-1" });
    await enqueue({ ...item, id: "theirs", applicantId: "app-2" });
    await enqueue({ ...item, id: "legacy" });
    const sent: string[] = [];
    const result = await drain(async (q) => { sent.push(q.id); }, "app-1");
    expect(sent).toEqual(["mine"]);
    expect(result).toEqual({ sent: 1, failed: 0, dropped: 2 });
    expect(await readQueue()).toEqual([]);
  });

  it("sends and drops nothing while nobody is signed in", async () => {
    await enqueue({ ...item, applicantId: "app-1" });
    const send = vi.fn();
    expect(await drain(send, null)).toEqual({ sent: 0, failed: 0, dropped: 0 });
    expect(send).not.toHaveBeenCalled();
    expect(await readQueue()).toHaveLength(1);
  });

  it("stores the queue sealed: no file name or contents in plaintext", async () => {
    await enqueue({ ...item, filename: "secret-contract.pdf", dataUrl: "data:application/pdf;base64,SECRETBYTES", applicantId: "app-1" });
    const raw = [...store.values()].join("");
    expect(raw).toMatch(/^bi-enc1:/);
    expect(raw).not.toContain("secret-contract");
    expect(raw).not.toContain("SECRETBYTES");
    expect((await readQueue())[0].filename).toBe("secret-contract.pdf");
  });

  it("drops a plaintext queue left by an older build instead of reading it", async () => {
    store.set("boreal_bi_upload_queue", JSON.stringify([{ ...item, attempts: 0, queuedAt: 1 }]));
    expect(await readQueue()).toEqual([]);
    expect(store.has("boreal_bi_upload_queue")).toBe(false);
  });

  it("clearQueue removes every queued file", async () => {
    await enqueue({ ...item, applicantId: "app-1" });
    await clearQueue();
    expect(await readQueue()).toEqual([]);
  });
});
