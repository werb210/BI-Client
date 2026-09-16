import { Capacitor } from "@capacitor/core";
import { Preferences } from "@capacitor/preferences";
import { SecureStorage } from "@aparajita/capacitor-secure-storage";

// These names are intentionally BI-applicant-specific. Never share auth keys
// with a Boreal staff or BF application.
export const APPLICANT_TOKEN_KEY = "boreal_bi_applicant_token";
export const APPLICANT_PHONE_KEY = "boreal_bi_applicant_phone";
const PHONE_KEY = APPLICANT_PHONE_KEY;

const native = () => Capacitor.isNativePlatform();
let cachedToken: string | null = null;
let restored = false;

export function getCachedToken(): string | null { return cachedToken; }
export function isTokenRestored(): boolean { return restored; }

export async function restoreToken(): Promise<string | null> {
  try {
    if (native()) {
      const value = await SecureStorage.get(APPLICANT_TOKEN_KEY);
      cachedToken = typeof value === "string" ? value : null;
    } else {
      cachedToken = localStorage.getItem(APPLICANT_TOKEN_KEY);
    }
  } catch {
    // Secure storage failure is fail-closed: never fall back to plaintext on native.
    cachedToken = null;
  } finally {
    restored = true;
  }
  return cachedToken;
}

export async function setToken(token: string): Promise<void> {
  if (native()) await SecureStorage.set(APPLICANT_TOKEN_KEY, token);
  else localStorage.setItem(APPLICANT_TOKEN_KEY, token);
  cachedToken = token;
  restored = true;
}

export async function getPhone(): Promise<string | null> {
  try {
    return native()
      ? (await Preferences.get({ key: PHONE_KEY })).value
      : localStorage.getItem(PHONE_KEY);
  } catch { return null; }
}

export async function setPhone(phone: string): Promise<void> {
  if (native()) await Preferences.set({ key: PHONE_KEY, value: phone });
  else localStorage.setItem(PHONE_KEY, phone);
}

export function clearToken(): Promise<void> {
  return clearApplicantSession();
}

async function clearApplicantSession(): Promise<void> {
  cachedToken = null;
  // BI_CLIENT_BACKGROUND_SYNC_v308 - stop anything the phone was still sending.
  void import("@/native/backgroundSync").then((m) => m.cancelBackgroundSync()).catch((): void => undefined);
  // BI_CLIENT_OFFLINE_v302 - cached screens and unsent saves belong to this applicant only.
  void import("@/offline/offlineStore").then((m) => m.clearOfflineData()).catch((): void => undefined);
  if (native()) {
    // Do not erase the entire Keychain/Preferences domains: they may later hold
    // other BI-only state. Remove only this applicant session.
    await Promise.allSettled([
      SecureStorage.remove(APPLICANT_TOKEN_KEY),
      Preferences.remove({ key: PHONE_KEY }),
    ]);
  } else {
    localStorage.removeItem(APPLICANT_TOKEN_KEY);
    localStorage.removeItem(PHONE_KEY);
  }
}
