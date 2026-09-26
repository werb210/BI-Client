// BI_CLIENT_BLOCK_v551_APP_BADGE
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { badgeCount } from "../appBadge";

describe("v551 app badge", () => {
  it("clamps the count", () => {
    expect(badgeCount(2)).toBe(2);
    expect(badgeCount(null)).toBe(0);
    expect(badgeCount(500)).toBe(99);
  });
  it("is driven by the action center and cleared on sign-out", () => {
    expect(readFileSync("src/components/ActionCenter.tsx", "utf-8")).toContain("m.setAppBadge(d?.outstandingCount)");
    expect(readFileSync("src/auth/token.ts", "utf-8")).toContain("m.clearAppBadge()");
    expect(readFileSync("ios/App/App/DocumentScannerPlugin.swift", "utf-8")).toContain("registerPluginInstance(AppBadgePlugin())");
    expect(readFileSync("ios/App/App/AppDelegate.swift", "utf-8")).toContain('jsName = "AppBadge"');
  });
});
