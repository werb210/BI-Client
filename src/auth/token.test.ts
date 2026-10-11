import { beforeEach, describe, expect, it, vi } from "vitest";
import { Capacitor } from "@capacitor/core";
import { Preferences } from "@capacitor/preferences";
import { SecureStorage } from "@aparajita/capacitor-secure-storage";
import * as token from "./token";
import { DATA_KEY_NAME } from "@/secure/vault";

beforeEach(() => {
  localStorage.clear();
  vi.restoreAllMocks();
});

describe("applicant token storage", () => {
  it("restores an existing browser token", async () => {
    vi.spyOn(Capacitor, "isNativePlatform").mockReturnValue(false);
    localStorage.setItem("boreal_bi_applicant_token", "browser-token");
    await expect(token.restoreToken()).resolves.toBe("browser-token");
    expect(token.getCachedToken()).toBe("browser-token");
    expect(token.isTokenRestored()).toBe(true);
  });

  it("writes a browser token to localStorage", async () => {
    vi.spyOn(Capacitor, "isNativePlatform").mockReturnValue(false);
    await token.setToken("browser-token");

    expect(localStorage.getItem(token.APPLICANT_TOKEN_KEY)).toBe("browser-token");
  });

  it("removes the browser token and phone on logout", async () => {
    vi.spyOn(Capacitor, "isNativePlatform").mockReturnValue(false);
    localStorage.setItem(token.APPLICANT_TOKEN_KEY, "browser-token");
    localStorage.setItem(token.APPLICANT_PHONE_KEY, "+15555550100");

    await token.clearToken();

    expect(localStorage.getItem(token.APPLICANT_TOKEN_KEY)).toBeNull();
    expect(localStorage.getItem(token.APPLICANT_PHONE_KEY)).toBeNull();
    expect(token.getCachedToken()).toBeNull();
  });

  it("restores a native token from SecureStorage", async () => {
    vi.spyOn(Capacitor, "isNativePlatform").mockReturnValue(true);
    const get = vi.spyOn(SecureStorage, "get").mockResolvedValue("native-token");
    await expect(token.restoreToken()).resolves.toBe("native-token");
    expect(get).toHaveBeenCalledWith(token.APPLICANT_TOKEN_KEY);
  });

  it("writes a native token with SecureStorage", async () => {
    vi.spyOn(Capacitor, "isNativePlatform").mockReturnValue(true);
    const set = vi.spyOn(SecureStorage, "set").mockResolvedValue(undefined);
    await token.setToken("native-token");

    expect(set).toHaveBeenCalledWith(token.APPLICANT_TOKEN_KEY, "native-token");
    expect(token.getCachedToken()).toBe("native-token");
  });

  it("removes only the native applicant token, the data key and the phone (Face ID sign-in stays)", async () => {
    vi.spyOn(Capacitor, "isNativePlatform").mockReturnValue(true);
    const secureRemove = vi.spyOn(SecureStorage, "remove").mockResolvedValue(undefined);
    const preferencesRemove = vi.spyOn(Preferences, "remove").mockResolvedValue(undefined);
    await token.clearToken();

    // BI_CLIENT_v789 - sign-out also forgets the at-rest encryption key.
    expect(secureRemove.mock.calls.map((c) => c[0]).sort()).toEqual([token.APPLICANT_TOKEN_KEY, DATA_KEY_NAME].sort());
    expect(preferencesRemove).toHaveBeenCalledWith({ key: token.APPLICANT_PHONE_KEY });
  });

  it("an expired session (401) drops the token but leaves the data key and queued uploads", async () => {
    vi.spyOn(Capacitor, "isNativePlatform").mockReturnValue(true);
    const secureRemove = vi.spyOn(SecureStorage, "remove").mockResolvedValue(undefined);
    const clear = vi.spyOn(Preferences, "clear");
    await token.setToken("native-token");
    await token.expireSession();

    expect(token.getCachedToken()).toBeNull();
    expect(secureRemove.mock.calls.map((c) => c[0])).toEqual([token.APPLICANT_TOKEN_KEY]);
    expect(clear).not.toHaveBeenCalled();
  });

  it("names the applicant a token belongs to", async () => {
    const jwt = (claims: object) => `h.${btoa(JSON.stringify(claims)).replace(/=+$/, "")}.s`;
    expect(token.applicantIdFromToken(jwt({ sub: "app-1", exp: 1 }))).toBe("app-1");
    expect(token.applicantIdFromToken(jwt({ contactId: "c-9" }))).toBe("c-9");
    expect(token.applicantIdFromToken(jwt({ exp: 1 }))).toBeNull();
    expect(token.applicantIdFromToken("not-a-jwt")).toBeNull();
    expect(token.applicantIdFromToken(null)).toBeNull();
    vi.spyOn(Capacitor, "isNativePlatform").mockReturnValue(false);
    await token.setToken(jwt({ sub: "app-2" }));
    expect(token.currentApplicantId()).toBe("app-2");
  });

  it("fails closed when native secure storage throws", async () => {
    vi.spyOn(Capacitor, "isNativePlatform").mockReturnValue(true);
    vi.spyOn(SecureStorage, "get").mockRejectedValue(new Error("unavailable"));
    localStorage.setItem("boreal_bi_applicant_token", "plaintext-token");
    await expect(token.restoreToken()).resolves.toBeNull();
    expect(token.getCachedToken()).toBeNull();
    expect(token.isTokenRestored()).toBe(true);
  });

  it("treats a missing native token as unauthenticated", async () => {
    vi.spyOn(Capacitor, "isNativePlatform").mockReturnValue(true);
    vi.spyOn(SecureStorage, "get").mockResolvedValue(null);
    await expect(token.restoreToken()).resolves.toBeNull();
    expect(token.isTokenRestored()).toBe(true);
  });
});
