// BI_CLIENT_BLOCK_v095_DRAIN_ON_RESUME_v1
import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

const hook = fs.readFileSync(path.resolve(__dirname, "./useQueueDrain.ts"), "utf8");
const app = fs.readFileSync(path.resolve(__dirname, "../App.tsx"), "utf8");

describe("queue drain on resume", () => {
  it("listens to the event NativeBridge already dispatches", () => {
    // useBiometricLock uses the same event; this is a second consumer, not new plumbing.
    expect(hook).toContain('window.addEventListener("boreal:native-resume"');
    expect(hook).toContain('window.removeEventListener("boreal:native-resume"');
  });

  it("guards against a concurrent drain", () => {
    expect(hook).toContain("if (running.current) return");
    expect(hook).toContain("finally { running.current = false; }");
  });

  it("does not attempt while offline or with an empty queue", () => {
    expect(hook).toMatch(/readQueue\(\)\)\.length === 0\) return/);
    expect(hook).toMatch(/Network\.getStatus\(\)\)\.connected\) return/);
  });

  it("retries when the network comes back, not only on resume", () => {
    expect(hook).toContain('Network.addListener("networkStatusChange"');
  });

  it("is mounted at the app shell so it runs on any page", () => {
    expect(app).toContain("useQueueDrain(");
  });

  it("stays inert on web", () => {
    expect(hook).toContain("if (!Capacitor.isNativePlatform()) return");
  });
});
