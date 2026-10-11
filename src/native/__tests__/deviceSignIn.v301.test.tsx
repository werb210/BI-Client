// BI_CLIENT_FACE_ID_SIGN_IN_v301
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";

const store = vi.hoisted(() => new Map<string, string>());
const post = vi.hoisted(() => vi.fn());
const authenticate = vi.hoisted(() => vi.fn(async () => undefined));
const setToken = vi.hoisted(() => vi.fn(async () => undefined));

const clearToken = vi.hoisted(() => vi.fn(async () => undefined));
const apiRequest = vi.hoisted(() => vi.fn(async (_path: string, _init?: unknown) => ({ unreadCount: 0 })));
const startOtp = vi.hoisted(() => vi.fn(async (_phone: string) => ({ ok: true })));
const verifyOtp = vi.hoisted(() => vi.fn(async (_phone: string, _code: string) => ({ token: "jwt", phone: "+17805551212", contactId: null })));
const destination = vi.hoisted(() => ({ seenHint: null as string | null }));
const signedInDestination = vi.hoisted(() => vi.fn(async () => {
  destination.seenHint = sessionStorage.getItem("boreal_bi_face_id_hint");
  return "/start";
}));

// In tests every Capacitor package is aliased to one mock module (vite.config.ts),
// so this single mock provides both Capacitor and SecureStorage; the rest of the
// mock module is kept.
vi.mock("@capacitor/core", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  Capacitor: { isNativePlatform: () => true, getPlatform: () => "ios", isPluginAvailable: () => false, convertFileSrc: (p: string) => p },
  SecureStorage: {
    get: async (k: string) => store.get(k) ?? null,
    set: async (k: string, v: string) => { store.set(k, v); },
    remove: async (k: string) => { store.delete(k); },
  },
}));
vi.mock("@aparajita/capacitor-biometric-auth", () => ({ BiometricAuth: { authenticate, checkBiometry: async () => ({ isAvailable: true }) } }));
vi.mock("@/api/client", () => {
  class ApiError extends Error { status: number; code: string; constructor(status: number, code: string) { super(code); this.status = status; this.code = code; } }
  return { api: { post, get: vi.fn() }, apiRequest, ApiError };
});
vi.mock("@/auth/token", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  getCachedToken: () => "token",
  setToken,
  setPhone: async () => undefined,
  clearToken,
}));
vi.mock("@/api/otp", () => ({ startOtp, verifyOtp }));
vi.mock("@/auth/signedInDestination", () => ({ signedInDestination }));
// Home's other panels are not under test here.
vi.mock("@/components/ActionCenter", () => ({ default: () => null }));
vi.mock("@/components/ApplicationProgress", () => ({ default: () => null }));
vi.mock("@/components/onboarding/FeatureTour", () => ({ default: () => null }));

import { DEVICE_KEY, HINT_KEY, disableFaceIdSignIn, isEnrolled, parseStored, signInWithFaceId } from "../deviceSignIn";
import { ApiError } from "@/api/client";
import SignInPage from "@/pages/SignInPage";
import HomePage from "@/pages/HomePage";

function renderRoutes(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/" element={<SignInPage />} />
        <Route path="/home" element={<HomePage />} />
        <Route path="/start" element={<h1>Step 1</h1>} />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  store.clear(); post.mockReset(); authenticate.mockClear(); setToken.mockClear();
  clearToken.mockClear(); signedInDestination.mockClear(); verifyOtp.mockClear();
  destination.seenHint = null;
  sessionStorage.clear();
});

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

  it("is on the sign-in page for an enrolled phone and signs in with it", async () => {
    store.set(DEVICE_KEY, JSON.stringify({ credentialId: "c-1", secret: "s-1" }));
    post.mockResolvedValueOnce({ token: "jwt", phone: "+17805551212", secret: "s-2" });
    renderRoutes("/");
    const button = await screen.findByTestId("face-id-sign-in");
    expect(button.textContent).toBe("Sign in with Face ID");
    fireEvent.click(button);
    expect(await screen.findByRole("heading", { name: "Step 1" })).toBeTruthy();
    expect(authenticate).toHaveBeenCalledTimes(1);
    expect(post).toHaveBeenCalledWith("/applicants/device-sign-in", { credentialId: "c-1", secret: "s-1" });
    expect(setToken).toHaveBeenCalledWith("jwt");
  });

  it("drops the button and explains when the credential has expired", async () => {
    store.set(DEVICE_KEY, JSON.stringify({ credentialId: "c-1", secret: "s-1" }));
    post.mockRejectedValueOnce(new (ApiError as any)(401, "device_sign_in_invalid"));
    renderRoutes("/");
    fireEvent.click(await screen.findByTestId("face-id-sign-in"));
    expect(await screen.findByText("Face ID sign-in has expired. Sign in with a text code to turn it back on.")).toBeTruthy();
    expect(screen.queryByTestId("face-id-sign-in")).toBeNull();
    expect(signedInDestination).not.toHaveBeenCalled();
  });

  it("offers Face ID once after a text-code sign-in, before leaving the page", async () => {
    renderRoutes("/");
    fireEvent.change(await screen.findByLabelText("Mobile number"), { target: { value: "7805551212" } });
    fireEvent.change(await screen.findByLabelText("6-digit code"), { target: { value: "123456" } });
    expect(await screen.findByRole("heading", { name: "Step 1" })).toBeTruthy();
    expect(verifyOtp).toHaveBeenCalledWith("7805551212", "123456");
    expect(sessionStorage.getItem(HINT_KEY)).toBe("1");
    expect(destination.seenHint).toBe("1");
  });

  it("the sign-out button turns Face ID sign-in off before signing out", async () => {
    store.set(DEVICE_KEY, JSON.stringify({ credentialId: "c-1", secret: "s-1" }));
    post.mockResolvedValueOnce({ revoked: 1 });
    renderRoutes("/home");
    fireEvent.click(screen.getByRole("button", { name: "Sign out" }));
    await waitFor(() => expect(clearToken).toHaveBeenCalledTimes(1));
    expect(post).toHaveBeenCalledWith("/applicants/device-sign-in/revoke", { credentialId: "c-1" });
    expect(post.mock.invocationCallOrder[0]).toBeLessThan(clearToken.mock.invocationCallOrder[0]);
    expect(store.has(DEVICE_KEY)).toBe(false);
    expect(await screen.findByLabelText("Mobile number")).toBeTruthy();
  });
});
