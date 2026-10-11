// BI_CLIENT_LOCK_ORDER_v363 - the Face ID lock decides before the app renders,
// and a session renewed by Face ID takes the applicant off the sign-in page.
import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, render, renderHook, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { expiredJwt, liveJwt } from "@/test-utils/pages2-helpers";

const env = vi.hoisted(() => ({ native: true }));
const biometry = vi.hoisted(() => ({
  checkBiometry: vi.fn(async () => ({ isAvailable: true })),
  authenticate: vi.fn(async (_options?: unknown) => undefined),
}));
const device = vi.hoisted(() => ({
  isEnrolled: vi.fn(async () => true),
  refreshSessionForBackground: vi.fn(async (_base: string): Promise<string | null> => null),
}));
const signedInDestination = vi.hoisted(() => vi.fn(async () => "/home"));

// Every @capacitor/* package is one module in tests: one mock, original kept.
vi.mock("@capacitor/core", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/test-capacitor-mock")>();
  return {
    ...original,
    Capacitor: { ...original.Capacitor, isNativePlatform: () => env.native, getPlatform: () => (env.native ? "ios" : "web") },
  };
});
vi.mock("@aparajita/capacitor-biometric-auth", () => ({ BiometricAuth: biometry }));
vi.mock("@/native/deviceSignIn", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  isEnrolled: device.isEnrolled,
  refreshSessionForBackground: device.refreshSessionForBackground,
}));
vi.mock("@/auth/signedInDestination", () => ({ signedInDestination }));

import { useBiometricLock } from "@/native/useBiometricLock";
import { BiometricGate } from "@/native/BiometricGate";
import SignInPage from "@/pages/SignInPage";
import { expireSession, setToken } from "@/auth/token";

function deferred<T>() {
  let resolve: (value: T) => void = () => undefined;
  const promise = new Promise<T>((r) => { resolve = r; });
  return { promise, resolve };
}

beforeEach(async () => {
  env.native = true;
  await expireSession();
  localStorage.clear();
  biometry.checkBiometry.mockReset();
  biometry.checkBiometry.mockResolvedValue({ isAvailable: true });
  biometry.authenticate.mockReset();
  biometry.authenticate.mockResolvedValue(undefined);
  device.isEnrolled.mockReset();
  device.isEnrolled.mockResolvedValue(true);
  device.refreshSessionForBackground.mockReset();
  device.refreshSessionForBackground.mockImplementation(async () => {
    const fresh = liveJwt();
    await setToken(fresh);
    return fresh;
  });
  signedInDestination.mockClear();
});

function trackLock() {
  const seen: Array<{ locked: boolean; ready: boolean }> = [];
  const hook = renderHook(() => {
    const value = useBiometricLock();
    seen.push({ locked: value.locked, ready: value.ready });
    return value;
  });
  return { seen, hook };
}

describe("Face ID lock decides before the app renders", () => {
  it("is ready from the first render on the web", () => {
    env.native = false;
    const { seen, hook } = trackLock();
    expect(seen[0]).toEqual({ locked: false, ready: true });
    expect(typeof hook.result.current.unlock).toBe("function");
  });

  it("on the phone, reports ready only after its first check, unlocked without a session", async () => {
    const { seen, hook } = trackLock();
    expect(seen[0]).toEqual({ locked: false, ready: false });
    await waitFor(() => expect(hook.result.current.ready).toBe(true));
    expect(hook.result.current.locked).toBe(false);
    expect(biometry.checkBiometry).not.toHaveBeenCalled();
  });

  it("on the phone, a cold start with a session and Face ID locks, then reports ready", async () => {
    await setToken(liveJwt());
    const check = deferred<{ isAvailable: boolean }>();
    biometry.checkBiometry.mockReturnValueOnce(check.promise);
    const { seen, hook } = trackLock();
    await waitFor(() => expect(biometry.checkBiometry).toHaveBeenCalled());
    expect(hook.result.current.ready).toBe(false);
    await act(async () => { check.resolve({ isAvailable: true }); });
    await waitFor(() => expect(hook.result.current.ready).toBe(true));
    expect(hook.result.current.locked).toBe(true);
    // It never claimed to be ready while still unlocked-by-default.
    expect(seen.some((s) => s.ready && !s.locked)).toBe(false);
  });

  it("the gate renders nothing until ready, and the app only when unlocked", async () => {
    await setToken(liveJwt());
    const check = deferred<{ isAvailable: boolean }>();
    biometry.checkBiometry.mockReturnValueOnce(check.promise);
    const unlock = deferred<undefined>();
    biometry.authenticate.mockReturnValueOnce(unlock.promise);

    render(<BiometricGate><p>Private app</p></BiometricGate>);
    expect(screen.getByRole("status", { name: "Loading" })).toBeTruthy();
    expect(screen.queryByText("Private app")).toBeNull();

    await act(async () => { check.resolve({ isAvailable: true }); });
    expect(await screen.findByText("Boreal Risk is locked")).toBeTruthy();
    expect(screen.queryByText("Private app")).toBeNull();
    expect(screen.queryByRole("status", { name: "Loading" })).toBeNull();
    expect(biometry.authenticate).toHaveBeenCalledTimes(1);

    await act(async () => { unlock.resolve(undefined); });
    expect(await screen.findByText("Private app")).toBeTruthy();
    expect(screen.queryByText("Boreal Risk is locked")).toBeNull();
  });

  it("the gate shows the app at once when the phone has no Face ID", async () => {
    await setToken(liveJwt());
    biometry.checkBiometry.mockResolvedValue({ isAvailable: false });
    render(<BiometricGate><p>Private app</p></BiometricGate>);
    expect(await screen.findByText("Private app")).toBeTruthy();
    expect(biometry.authenticate).not.toHaveBeenCalled();
  });
});

describe("a renewed session is announced and the sign-in page leaves", () => {
  it("unlock renews an expired session and announces it", async () => {
    await setToken(expiredJwt());
    const renewed = vi.fn();
    window.addEventListener("boreal:session-renewed", renewed);
    try {
      const { hook } = trackLock();
      await waitFor(() => expect(hook.result.current.locked).toBe(true));
      let ok = false;
      await act(async () => { ok = await hook.result.current.unlock(); });
      expect(ok).toBe(true);
      expect(device.refreshSessionForBackground).toHaveBeenCalledTimes(1);
      expect(renewed).toHaveBeenCalledTimes(1);
      expect(device.refreshSessionForBackground.mock.invocationCallOrder[0]).toBeLessThan(renewed.mock.invocationCallOrder[0]);
      expect(hook.result.current.locked).toBe(false);
    } finally {
      window.removeEventListener("boreal:session-renewed", renewed);
    }
  });

  it("unlock with a still-valid session does not announce a renewal", async () => {
    await setToken(liveJwt());
    const renewed = vi.fn();
    window.addEventListener("boreal:session-renewed", renewed);
    try {
      const { hook } = trackLock();
      await waitFor(() => expect(hook.result.current.ready).toBe(true));
      await act(async () => { await hook.result.current.unlock(); });
      expect(device.refreshSessionForBackground).not.toHaveBeenCalled();
      expect(renewed).not.toHaveBeenCalled();
    } finally {
      window.removeEventListener("boreal:session-renewed", renewed);
    }
  });

  it("the sign-in page leaves when a renewed session is announced", async () => {
    env.native = false;
    await setToken(expiredJwt());
    render(
      <MemoryRouter initialEntries={["/"]}>
        <Routes>
          <Route path="/" element={<SignInPage />} />
          <Route path="/home" element={<h1>Home screen</h1>} />
        </Routes>
      </MemoryRouter>,
    );
    expect(screen.getByLabelText("Mobile number")).toBeTruthy();

    // An announcement while the session is still expired changes nothing.
    act(() => { window.dispatchEvent(new Event("boreal:session-renewed")); });
    expect(signedInDestination).not.toHaveBeenCalled();

    await setToken(liveJwt());
    act(() => { window.dispatchEvent(new Event("boreal:session-renewed")); });
    expect(await screen.findByRole("heading", { name: "Home screen" })).toBeTruthy();
    expect(signedInDestination).toHaveBeenCalledTimes(1);
  });

  it("Face ID unlock over an expired session ends on the signed-in destination", async () => {
    await setToken(expiredJwt());
    render(
      <MemoryRouter initialEntries={["/"]}>
        <BiometricGate>
          <Routes>
            <Route path="/" element={<SignInPage />} />
            <Route path="/home" element={<h1>Home screen</h1>} />
          </Routes>
        </BiometricGate>
      </MemoryRouter>,
    );
    expect(await screen.findByRole("heading", { name: "Home screen" })).toBeTruthy();
    expect(biometry.authenticate).toHaveBeenCalled();
    expect(device.refreshSessionForBackground).toHaveBeenCalledTimes(1);
  });
});
