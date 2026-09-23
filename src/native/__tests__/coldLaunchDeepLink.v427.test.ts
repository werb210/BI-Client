// BI_CLIENT_COLD_LAUNCH_DEEPLINK_v427
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { parseNativeUrl } from "../deepLinks";

const src = readFileSync(path.join(process.cwd(), "src/native/NativeBridge.tsx"), "utf8");

describe("v427 a link that cold-launches BI-Client still routes", () => {
  it("reads the launch URL iOS delivers only once", () => {
    expect(src).toContain("getLaunchUrl()");
  });

  it("reads it before the live listener is attached", () => {
    expect(src.indexOf("getLaunchUrl()"))
      .toBeLessThan(src.indexOf('addListener("appUrlOpen"'));
  });

  it("does nothing on an ordinary start", () => {
    expect(src).toContain("if (launch?.url)");
  });

  it("routes the BI destinations a cold launch would carry", () => {
    expect(parseNativeUrl("borealrisk://coverage/abc123", true)).toBe("/coverage/abc123");
    expect(parseNativeUrl("borealrisk://questions/abc123", true)).toBe("/questions/abc123");
  });

  it("does not follow a foreign scheme into an arbitrary route", () => {
    expect(parseNativeUrl("https://evil.example.com/coverage/1", true)).not.toContain("evil");
  });
});
