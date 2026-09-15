// BI_CLIENT_PUSH_OPT_IN_v241
import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import { enablePushAfterSignIn } from "@/native/pushNotifications";

function api(first: string, afterAsk = "granted") {
  return {
    checkPermissions: vi.fn(async () => ({ receive: first })),
    requestPermissions: vi.fn(async () => ({ receive: afterAsk })),
    register: vi.fn(async () => undefined),
  };
}

describe("push opt-in after sign-in", () => {
  it("asks when undecided and registers on yes", async () => {
    const a = api("prompt", "granted");
    expect(await enablePushAfterSignIn(a, true)).toBe("granted");
    expect(a.requestPermissions).toHaveBeenCalledTimes(1);
    expect(a.register).toHaveBeenCalledTimes(1);
  });
  it("does not register when the applicant says no", async () => {
    const a = api("prompt", "denied");
    expect(await enablePushAfterSignIn(a, true)).toBe("denied");
    expect(a.register).not.toHaveBeenCalled();
  });
  it("re-registers without asking when already granted, so the token follows sign-in", async () => {
    const a = api("granted");
    expect(await enablePushAfterSignIn(a, true)).toBe("granted");
    expect(a.requestPermissions).not.toHaveBeenCalled();
    expect(a.register).toHaveBeenCalledTimes(1);
  });
  it("is a no-op on the web and never throws", async () => {
    expect(await enablePushAfterSignIn(api("prompt"), false)).toBe("unavailable");
    const broken = { checkPermissions: vi.fn(async () => { throw new Error("x"); }), requestPermissions: vi.fn(), register: vi.fn() };
    expect(await enablePushAfterSignIn(broken as any, true)).toBe("unavailable");
  });
  it("is called from the signed-in home screen", () => {
    expect(readFileSync("src/pages/HomePage.tsx", "utf-8")).toContain("void enablePushAfterSignIn();");
  });
});

describe("iOS notification buttons", () => {
  const swift = readFileSync("ios/App/App/AppDelegate.swift", "utf-8");
  it("registers the categories BI-Server sends at launch", () => {
    expect(swift).toContain("BorealRiskPushCategories.register(); return true");
    expect(swift).toContain('identifier: "DOCUMENT_REQUEST"');
    expect(swift).toContain('identifier: "APPLICATION_UPDATE"');
    expect(swift).toContain("import UserNotifications");
  });
});
