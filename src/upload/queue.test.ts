// BI_CLIENT_BLOCK_v092_CAPTURE_POLISH_v1
import { describe, expect, it, beforeEach, vi } from "vitest";

const store = new Map<string, string>();
vi.mock("@capacitor/preferences", () => ({
  Preferences: {
    get: async ({ key }: { key: string }) => ({ value: store.get(key) ?? null }),
    set: async ({ key, value }: { key: string; value: string }) => { store.set(key, value); },
  },
}));

import { enqueue, readQueue, dequeue, recordFailure, drain } from "./queue";

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
    expect(result).toEqual({ sent: 1, failed: 1 });
    expect((await readQueue()).map((q) => q.id)).toEqual(["a2"]);
  });
});
