// BI_CLIENT_FACE_ID_SIGN_IN_v301
import { beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const store = vi.hoisted(() => new Map<string, string>());
const post = vi.hoisted(() => vi.fn());
const authenticate = vi.hoisted(() => vi.fn(async () => undefined));
const setToken = vi.hoisted(() => vi.fn(async () => undefined));

// In tests every Capacitor package is aliased to one mock module (vite.config.ts),
// so a single mock provides both Capacitor and SecureStorage.
vi.mock("@capacitor/core", () => ({
  Capacitor: { isNativePlatform: () => true, getPlatform: () => "ios" },
  SecureStorage: {
    get: async (k: string) => store.get(k) ?? null,
    set: async (k: string, v: string) => { store.set(k, v); },
    remove: async (k: string) => { store.delete(k); },
  },
}));
vi.mock("@aparajita/capacitor-biometric-auth", () => ({ BiometricAuth: { authenticate, checkBiometry: async () => ({ isAvailable: true }) } }));
vi.mock("@/api/client", () => {
  class ApiError extends Error { status: number; code: string; constructor(status: number, code: string) { super(code); this.status = status; this.code = code; } }
  return { api: { post }, ApiError };
});
vi.mock("@/auth/token", () => ({ getCachedToken: () => "token", setToken, setPhone: async () => undefined }));

import { DEVICE_KEY, disableFaceIdSignIn, isEnrolled, parseStored, signInWithFaceId } from "../deviceSignIn";
import { ApiError } from "@/api/client";

beforeEach(() => { store.clear(); post.mockReset(); authenticate.mockClear(); setToken.mockClear(); });

describe("BI Face ID sign-in", () => {
  it("needs Face ID first, then saves the session and the rotated secret", async () => {
    store.set(DEVICE_KEY, JSON.stringify({ credentialId: "c-1", secret: "s-1" }));
    post.mockResolvedValueOnce({ token: "jwt", phone: "+17805551212", secret: "s-2" });
    await signInWithFaceId();
    expect(authenticate.mock.invocationCallOrder[0]).toBeLessThan(post.mock.invocationCallOrder[0]);
    expect(post).toHaveBeenCalledWith("/applicants/device-sign-in", { credentialId: "c-1", secret: "s-1" });
    expect(setToken).toHaveBeenCalledWith("jwt");
    expect(parseStored(store.get(DEVICE_KEY))?.secret).toBe("s-2");
  });

  it("forgets a rejected credential", async () => {
    store.set(DEVICE_KEY, JSON.stringify({ credentialId: "c-1", secret: "s-1" }));
    post.mockRejectedValueOnce(new (ApiError as any)(401, "device_sign_in_invalid"));
    await expect(signInWithFaceId()).rejects.toMatchObject({ code: "expired" });
    expect(await isEnrolled()).toBe(false);
  });

  it("does not call the server when Face ID is cancelled", async () => {
    store.set(DEVICE_KEY, JSON.stringify({ credentialId: "c-1", secret: "s-1" }));
    authenticate.mockRejectedValueOnce(new Error("cancel"));
    await expect(signInWithFaceId()).rejects.toThrow("cancel");
    expect(post).not.toHaveBeenCalled();
  });

  it("sign-out revokes and clears", async () => {
    store.set(DEVICE_KEY, JSON.stringify({ credentialId: "c-1", secret: "s-1" }));
    post.mockResolvedValueOnce({ revoked: 1 });
    await disableFaceIdSignIn();
    expect(post).toHaveBeenCalledWith("/applicants/device-sign-in/revoke", { credentialId: "c-1" });
    expect(store.has(DEVICE_KEY)).toBe(false);
  });

  it("is on the sign-in page and the sign-out button", () => {
    const pages = join(__dirname, "..", "..", "pages");
    const signIn = readFileSync(join(pages, "SignInPage.tsx"), "utf8");
    expect(signIn).toContain('data-testid="face-id-sign-in"');
    expect(signIn).toContain("await offerFaceIdOnce();");
    expect(readFileSync(join(pages, "HomePage.tsx"), "utf8")).toContain("m.disableFaceIdSignIn()");
  });
});
