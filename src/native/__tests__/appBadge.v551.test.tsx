// BI_CLIENT_BLOCK_v551_APP_BADGE
import { readFileSync } from "node:fs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, waitFor } from "@testing-library/react";

const apiGet = vi.hoisted(() => vi.fn());
const nat = vi.hoisted(() => ({ on: false }));
const badgePlugin = vi.hoisted(() => ({ set: vi.fn(async (_o: { count: number }) => undefined) }));

// Every Capacitor package is one module in tests: one mock, original spread.
vi.mock("@capacitor/core", async (importOriginal) => {
  const orig = await importOriginal<typeof import("@capacitor/core")>();
  return {
    ...orig,
    Capacitor: { ...orig.Capacitor, isNativePlatform: () => nat.on, isPluginAvailable: (name: string) => nat.on && name === "AppBadge" },
    registerPlugin: (name: string) => (name === "AppBadge" ? badgePlugin : {}),
  };
});
vi.mock("@/api/client", () => ({ api: { get: apiGet, post: vi.fn() }, apiRequest: vi.fn() }));
vi.mock("@/native/appBadge", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/native/appBadge")>()),
  setAppBadge: vi.fn(async () => undefined),
  clearAppBadge: vi.fn(async () => undefined),
}));

import ActionCenter from "@/components/ActionCenter";
import { badgeCount, clearAppBadge, setAppBadge } from "@/native/appBadge";
import { clearToken, expireSession, setToken } from "@/auth/token";

beforeEach(() => {
  nat.on = false;
  apiGet.mockReset();
  vi.mocked(setAppBadge).mockClear();
  vi.mocked(clearAppBadge).mockClear();
  badgePlugin.set.mockClear();
});
afterEach(() => cleanup());

describe("v551 app badge", () => {
  it("clamps the count", () => {
    expect(badgeCount(2)).toBe(2);
    expect(badgeCount(null)).toBe(0);
    expect(badgeCount(500)).toBe(99);
  });

  it("hands the clamped count to the native AppBadge plugin, on the phone only", async () => {
    const real = await vi.importActual<typeof import("@/native/appBadge")>("@/native/appBadge");
    await real.setAppBadge(4);
    expect(badgePlugin.set).not.toHaveBeenCalled(); // web build: no badge
    nat.on = true;
    await real.setAppBadge(250);
    expect(badgePlugin.set).toHaveBeenLastCalledWith({ count: 99 });
    await real.clearAppBadge();
    expect(badgePlugin.set).toHaveBeenLastCalledWith({ count: 0 });
  });

  it("is driven by the action center's outstanding count", async () => {
    apiGet.mockResolvedValue({
      applicationId: "APP-1",
      outstanding: [
        { key: "a", kind: "document", label: "Certificate", urgent: false },
        { key: "b", kind: "question", label: "Revenue", urgent: false },
        { key: "c", kind: "question", label: "Staff", urgent: false },
      ],
      completed: [],
      outstandingCount: 3,
      canSubmit: false,
    });
    render(<ActionCenter applicationId="APP-1" />);
    await waitFor(() => expect(setAppBadge).toHaveBeenCalledWith(3));
    expect(apiGet).toHaveBeenCalledWith("/applicants/action-center/APP-1");
  });

  it("does not touch the badge when the action center fails to load", async () => {
    apiGet.mockRejectedValue(new Error("offline"));
    render(<ActionCenter applicationId="APP-1" />);
    await waitFor(() => expect(apiGet).toHaveBeenCalled());
    await new Promise((r) => setTimeout(r, 0));
    expect(setAppBadge).not.toHaveBeenCalled();
  });

  it("is cleared on sign-out", async () => {
    await setToken("t1");
    await clearToken();
    await waitFor(() => expect(clearAppBadge).toHaveBeenCalled());
  });

  it("is cleared when the session expires (401)", async () => {
    await setToken("t2");
    await expireSession();
    await waitFor(() => expect(clearAppBadge).toHaveBeenCalled());
  });

  it("is registered as a native plugin on iOS", () => {
    expect(readFileSync("ios/App/App/DocumentScannerPlugin.swift", "utf-8")).toContain("registerPluginInstance(AppBadgePlugin())");
    expect(readFileSync("ios/App/App/AppDelegate.swift", "utf-8")).toContain('jsName = "AppBadge"');
  });
});
