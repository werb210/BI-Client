import { beforeEach, describe, it, expect, vi } from "vitest";

const post = vi.hoisted(() => vi.fn());
const device = vi.hoisted(() => ({ native: false, platform: "web" }));
const pushListeners = vi.hoisted(() => ({} as Record<string, (event: any) => void>));
const push = vi.hoisted(() => ({
  addListener: vi.fn(async (name: string, cb: (event: any) => void) => { pushListeners[name] = cb; return { remove: async () => undefined }; }),
  checkPermissions: vi.fn(async () => ({ receive: "granted" })),
  register: vi.fn(async () => undefined),
}));

// Every Capacitor package is one module in tests: one mock, original spread.
vi.mock("@capacitor/core", async (importOriginal) => {
  const orig = await importOriginal<typeof import("@/test-capacitor-mock")>();
  return {
    ...orig,
    Capacitor: { ...orig.Capacitor, isNativePlatform: () => device.native, getPlatform: () => device.platform },
    PushNotifications: push,
  };
});
vi.mock("@/api/client", () => ({ api: { post, get: vi.fn() }, apiRequest: vi.fn() }));

import {
  devicePlatform,
  forgetPushDeviceToken,
  initializePushNotifications,
  registeredPushDeviceToken,
  serverRegistration,
  type DeviceRegistration,
} from "@/native/pushNotifications";

const TOKEN = "f".repeat(64);
const flush = () => new Promise((r) => setTimeout(r, 0));

beforeEach(async () => {
  device.native = false; device.platform = "web";
  post.mockReset(); post.mockResolvedValue({ ok: true });
  push.addListener.mockClear(); push.register.mockClear();
  for (const k of Object.keys(pushListeners)) delete pushListeners[k];
  await forgetPushDeviceToken();
});

describe("BI_CLIENT_PUSH_REGISTER_v159", () => {
  it("reports only the two platforms BI-Server can store", () => {
    // Off-device this is "web", which is not storable - so null, not a guess.
    expect(devicePlatform()).toBeNull();
    device.platform = "ios";
    expect(devicePlatform()).toBe("ios");
    device.platform = "android";
    expect(devicePlatform()).toBe("android");
  });

  it("never reports capacitor, the mistake BF-client made", () => {
    // BF-client sent platform:"capacitor" and every token was counted
    // unsupported by the server. This can only ever emit ios, android or null.
    device.platform = "capacitor";
    expect(devicePlatform()).toBeNull();
  });

  it("a registration carries exactly what the server stores", () => {
    const reg: DeviceRegistration = { token: TOKEN, platform: "ios" };
    expect(Object.keys(reg).sort()).toEqual(["platform", "token"]);
  });

  it("the adapter is injectable, so a test never hits the network", async () => {
    device.native = true; device.platform = "ios";
    const adapter = { register: vi.fn(async (_d: DeviceRegistration) => undefined) };
    await initializePushNotifications(() => undefined, adapter);
    pushListeners.registration({ value: ` ${TOKEN} ` });
    await flush();
    expect(adapter.register).toHaveBeenCalledWith({ token: TOKEN, platform: "ios" });
    expect(post).not.toHaveBeenCalled();
    expect(await registeredPushDeviceToken()).toBe(TOKEN); // remembered for sign-out
  });

  it("posts to the route BI-Server exposes, under the /api/v1 prefix", async () => {
    await serverRegistration.register({ token: TOKEN, platform: "android" });
    // ENV.API_PREFIX supplies /api/v1, so the path here is the remainder.
    expect(post).toHaveBeenCalledWith("/client/push/register-token", { token: TOKEN, platform: "android" });
  });

  it("a token the phone hands over is sent to the server by default, not kept on the device", async () => {
    device.native = true; device.platform = "android";
    await initializePushNotifications(() => undefined);
    expect(push.register).toHaveBeenCalled(); // permission already granted
    pushListeners.registration({ value: TOKEN });
    await flush();
    expect(post).toHaveBeenCalledWith("/client/push/register-token", { token: TOKEN, platform: "android" });
  });

  it("sends nothing for an empty token, and a server failure stays silent", async () => {
    device.native = true; device.platform = "ios";
    await initializePushNotifications(() => undefined);
    pushListeners.registration({ value: "  " });
    await flush();
    expect(post).not.toHaveBeenCalled();
    post.mockRejectedValue(new Error("500"));
    expect(() => pushListeners.registration({ value: TOKEN })).not.toThrow();
    await flush();
    expect(post).toHaveBeenCalledTimes(1);
  });

  it("registers nothing off-device", async () => {
    expect(await initializePushNotifications(() => undefined)).toEqual([]);
    expect(push.addListener).not.toHaveBeenCalled();
  });
});
