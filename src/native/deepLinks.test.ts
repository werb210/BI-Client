import { describe, expect, it } from "vitest";
import { consumeNativeDestination, parseNativeUrl, retainNativeDestination } from "./deepLinks";

describe("BI native URLs", () => {
  it.each([
    ["borealrisk://home", "/home"], ["borealrisk://upload", "/upload"],
    ["borealrisk://coverage/abc123", "/coverage/abc123"],
    ["borealrisk://questions/abc123", "/questions/abc123"],
    ["borealrisk://review/abc123", "/review/abc123"],
    ["borealrisk://requirements/abc123", "/requirements/abc123"],
  ])("maps %s", (url, route) => expect(parseNativeUrl(url, true)).toBe(route));
  it("fails closed", () => {
    expect(parseNativeUrl("borealrisk://coverage/a%2Fb", false)).toBe("/");
    expect(parseNativeUrl("borealrisk://unknown", true)).toBe("/home");
    expect(parseNativeUrl("https://example.com/home", false)).toBe("/");
  });
  it("retains a protected destination for exactly one post-login navigation", () => {
    retainNativeDestination("/requirements/abc123");
    expect(consumeNativeDestination()).toBe("/requirements/abc123");
    expect(consumeNativeDestination()).toBeNull();
  });
});
