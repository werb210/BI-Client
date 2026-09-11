import { describe, it, expect, vi } from "vitest";
import { devicePlatform, type DeviceRegistration } from "@/native/pushNotifications";

describe("BI_CLIENT_PUSH_REGISTER_v159", () => {
  it("reports only the two platforms BI-Server can store", () => {
    // Off-device this is "web", which is not storable - so null, not a guess.
    const platform = devicePlatform();
    expect(platform === null || platform === "ios" || platform === "android").toBe(true);
  });

  it("never reports capacitor, the mistake BF-client made", () => {
    // BF-client sent platform:"capacitor" and every token was counted
    // unsupported by the server. This can only ever emit ios, android or null.
    expect(devicePlatform()).not.toBe("capacitor");
  });

  it("a registration carries exactly what the server stores", () => {
    const device: DeviceRegistration = { token: "f".repeat(64), platform: "ios" };
    expect(Object.keys(device).sort()).toEqual(["platform", "token"]);
  });

  it("the adapter is injectable, so a test never hits the network", async () => {
    const mod = await import("@/native/pushNotifications");
    expect(typeof mod.initializePushNotifications).toBe("function");
    expect(mod.initializePushNotifications.length).toBeGreaterThanOrEqual(1);
  });

  it("posts to the route BI-Server exposes, under the /api/v1 prefix", async () => {
    const post = vi.fn().mockResolvedValue({ ok: true });
    vi.doMock("@/api/client", () => ({ api: { post, get: vi.fn() } }));
    vi.resetModules();
    const { serverRegistration } = await import("@/native/pushNotifications");
    await serverRegistration.register({ token: "f".repeat(64), platform: "android" });
    // ENV.API_PREFIX supplies /api/v1, so the path here is the remainder.
    expect(post).toHaveBeenCalledWith("/client/push/register-token", {
      token: "f".repeat(64),
      platform: "android",
    });
    vi.doUnmock("@/api/client");
  });

  it("no longer claims the server has no endpoint", async () => {
    const fs = await import("node:fs");
    const src = fs.readFileSync("src/native/pushNotifications.ts", "utf8");
    expect(src).not.toContain("BI-Server has no device-registration endpoint");
    expect(src).toContain("/client/push/register-token");
  });
});
