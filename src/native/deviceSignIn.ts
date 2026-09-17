// BI_CLIENT_FACE_ID_SIGN_IN_v301
// Face ID sign-in (BI-Server v300). The applicant session only lasts an hour,
// so without this every return visit needed a new text code. After a text-code
// sign-in the app can enroll; the device secret is kept in secure storage and
// is only read after Face ID succeeds. The server rotates it on every use.
import { Capacitor } from "@capacitor/core";
import { BiometricAuth } from "@aparajita/capacitor-biometric-auth";
import { SecureStorage } from "@aparajita/capacitor-secure-storage";
import { api, ApiError } from "@/api/client";
import { getCachedToken, setPhone, setToken } from "@/auth/token";

export const DEVICE_KEY = "boreal_bi_device_sign_in";
export const OFFERED_KEY = "boreal_bi_face_id_offered";

type Stored = { credentialId: string; secret: string };

export function parseStored(raw: unknown): Stored | null {
  try {
    const v = typeof raw === "string" ? JSON.parse(raw) : null;
    return v && typeof v.credentialId === "string" && typeof v.secret === "string" ? v : null;
  } catch {
    return null;
  }
}

async function read(): Promise<Stored | null> {
  if (!Capacitor.isNativePlatform()) return null;
  try { return parseStored(await SecureStorage.get(DEVICE_KEY)); } catch { return null; }
}

async function write(value: Stored): Promise<void> {
  await SecureStorage.set(DEVICE_KEY, JSON.stringify(value));
}

async function forget(): Promise<void> {
  try { await SecureStorage.remove(DEVICE_KEY); } catch { /* nothing stored */ }
}

export async function biometryAvailable(): Promise<boolean> {
  if (!Capacitor.isNativePlatform()) return false;
  try { return Boolean((await BiometricAuth.checkBiometry()).isAvailable); } catch { return false; }
}

export async function isEnrolled(): Promise<boolean> {
  return !!(await read());
}

// BI_CLIENT_FACE_ID_SETTING_v330
// biometryAvailable() collapses every reason to false, so a settings row gated
// on it can only disappear, never explain itself. Keep the reason.
export type BiometryStatus = { native: boolean; available: boolean; reason: string };

export async function biometryStatus(): Promise<BiometryStatus> {
  if (!Capacitor.isNativePlatform()) {
    return { native: false, available: false, reason: "Face ID needs the Boreal app on your phone or tablet." };
  }
  try {
    const info: any = await BiometricAuth.checkBiometry();
    if (info?.isAvailable) return { native: true, available: true, reason: "" };
    return { native: true, available: false, reason: String(info?.reason || "Face ID is not set up on this device. Turn it on in Settings, then come back.") };
  } catch (error: any) {
    return { native: true, available: false, reason: String(error?.message || "Face ID is not available on this device.") };
  }
}

export async function enrollThisDevice(): Promise<boolean> {
  if (!(await biometryAvailable()) || !getCachedToken()) return false;
  try {
    await BiometricAuth.authenticate({ reason: "Turn on Face ID sign-in", cancelTitle: "Not now", allowDeviceCredential: false });
    const r = await api.post<Stored>("/applicants/device-sign-in/enroll", { deviceLabel: Capacitor.getPlatform() });
    if (!r?.credentialId || !r?.secret) return false;
    await write({ credentialId: r.credentialId, secret: r.secret });
    return true;
  } catch {
    return false;
  }
}

export const HINT_KEY = "boreal_bi_face_id_hint";

// BI_CLIENT_FACE_ID_SETTING_v330 - enrollment now lives on the home screen.
export async function offerFaceIdOnce(): Promise<void> {
  try {
    localStorage.removeItem(OFFERED_KEY);
    if (!(await biometryAvailable()) || (await isEnrolled()) || !getCachedToken()) return;
    sessionStorage.setItem(HINT_KEY, "1");
  } catch {
    // Never block sign-in.
  }
}

export async function signInWithFaceId(): Promise<void> {
  const stored = await read();
  if (!stored) throw Object.assign(new Error("Face ID sign-in is not set up on this phone."), { code: "not_enrolled" });
  await BiometricAuth.authenticate({ reason: "Sign in to Boreal Risk Management", cancelTitle: "Use a text code", allowDeviceCredential: false });
  try {
    const r = await api.post<{ token: string; phone: string; secret: string }>("/applicants/device-sign-in", stored);
    if (!r?.token || !r?.secret) throw new Error("device_sign_in_failed");
    await write({ credentialId: stored.credentialId, secret: r.secret });
    await setToken(r.token);
    if (r.phone) await setPhone(r.phone);
  } catch (err) {
    if (err instanceof ApiError && err.status === 401) {
      await forget();
      throw Object.assign(new Error("Face ID sign-in has expired. Sign in with a text code to turn it back on."), { code: "expired" });
    }
    throw err;
  }
}

/** On sign-out: turn Face ID sign-in off on the server and forget it here. */
export async function disableFaceIdSignIn(): Promise<void> {
  const stored = await read();
  if (stored && getCachedToken()) {
    await api.post("/applicants/device-sign-in/revoke", { credentialId: stored.credentialId }).catch((): undefined => undefined);
  }
  await forget();
}

// BI_CLIENT_BACKGROUND_SYNC_v308
// Just before background sending, swap the device credential for a fresh
// one-hour session so the phone's sends are not refused with an expired one.
// No Face ID prompt: the applicant was using the app a moment ago. Uses fetch
// directly so a refused credential never signs the applicant out.
export async function refreshSessionForBackground(apiBase: string): Promise<string | null> {
  const stored = await read();
  if (!stored) return getCachedToken();
  try {
    const res = await fetch(`${apiBase}/applicants/device-sign-in`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(stored),
    });
    if (res.status === 401) { await forget(); return getCachedToken(); }
    if (!res.ok) return getCachedToken();
    const r = (await res.json()) as { token?: string; phone?: string; secret?: string };
    if (!r.token || !r.secret) return getCachedToken();
    await write({ credentialId: stored.credentialId, secret: r.secret });
    await setToken(r.token);
    return r.token;
  } catch {
    return getCachedToken();
  }
}
