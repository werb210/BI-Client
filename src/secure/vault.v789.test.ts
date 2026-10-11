// BI_CLIENT_v789_AT_REST_ENCRYPTION
import { beforeEach, describe, expect, it, vi } from "vitest";

const secure = new Map<string, string>();
let native = false;
vi.mock("@capacitor/core", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  Capacitor: { isNativePlatform: () => native, getPlatform: () => (native ? "ios" : "web"), isPluginAvailable: () => false, convertFileSrc: (p: string) => p },
  SecureStorage: {
    get: async (key: string) => secure.get(key) ?? null,
    set: async (key: string, value: string) => { secure.set(key, value); },
    remove: async (key: string) => { secure.delete(key); },
  },
}));

import { DATA_KEY_NAME, forgetDataKey, isSealed, seal, unseal } from "./vault";

beforeEach(async () => {
  native = false;
  await forgetDataKey();
  secure.clear();
});

describe("at-rest vault", () => {
  it("round-trips text and never stores it in plaintext", async () => {
    const sealed = await seal('{"name":"Pat Applicant","email":"pat@example.com"}');
    expect(isSealed(sealed)).toBe(true);
    expect(sealed).not.toContain("Pat");
    expect(sealed).not.toContain("example.com");
    expect(await unseal(sealed)).toBe('{"name":"Pat Applicant","email":"pat@example.com"}');
  });

  it("uses a fresh IV each time", async () => {
    expect(await seal("same")).not.toBe(await seal("same"));
  });

  it("reads plaintext, tampered data and missing values as nothing", async () => {
    expect(await unseal('[{"id":"a"}]')).toBeNull();
    expect(await unseal(null)).toBeNull();
    const sealed = await seal("hello");
    const tampered = sealed.slice(0, -4) + (sealed.endsWith("AAAA") ? "BBBB" : "AAAA");
    expect(await unseal(tampered)).toBeNull();
  });

  it("keeps the native key in the Keychain/Keystore (secure storage), not in Preferences", async () => {
    native = true;
    const sealed = await seal("contract");
    expect(secure.get(DATA_KEY_NAME)).toMatch(/^[A-Za-z0-9+/]{43}=$/); // 32 random bytes
    expect(await unseal(sealed)).toBe("contract");
  });

  it("forgetting the key at sign-out makes old data unreadable", async () => {
    native = true;
    const sealed = await seal("contract");
    await forgetDataKey();
    expect(secure.has(DATA_KEY_NAME)).toBe(false);
    expect(await unseal(sealed)).toBeNull();
  });
});
