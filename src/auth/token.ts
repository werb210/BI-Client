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

// BI_CLIENT_v789 - the applicant a token belongs to (JWT subject, or the
// applicant/contact id or phone the server put in it). Used to keep queued
// uploads with the applicant who queued them.
export function applicantIdFromToken(token: string | null | undefined): string | null {
  if (!token) return null;
  try {
    const part = token.split(".")[1];
    if (!part) return null;
    const claims = JSON.parse(atob(part.replace(/-/g, "+").replace(/_/g, "/"))) as Record<string, unknown>;
    for (const name of ["sub", "applicantId", "applicant_id", "contactId", "contact_id", "phone"]) {
      const value = claims[name];
      if ((typeof value === "string" && value.trim()) || typeof value === "number") return String(value).trim();
    }
    return null;
  } catch { return null; }
}

export function currentApplicantId(): string | null { return applicantIdFromToken(cachedToken); }

/**
 * Sign-out (the applicant asked, or deleted the account). BI_CLIENT_v789 -
 * signOutWipe() runs first, while the token can still unregister this phone's
 * push token, and removes everything this applicant left on the phone.
 */
export async function clearToken(): Promise<void> {
  try {
    const { signOutWipe } = await import("@/auth/signOutWipe");
    await signOutWipe(cachedToken);
  } catch { /* the session below is still cleared */ }
  await clearApplicantSession();
}

/**
 * BI_CLIENT_v789 - the server said 401 (the one-hour token expired). The
 * session ends, but queued contract files stay sealed on the phone: they carry
 * the applicant id, so they are sent only if the same applicant signs back in.
 */
export function expireSession(): Promise<void> {
  return clearApplicantSession();
}

async function clearApplicantSession(): Promise<void> {
  cachedToken = null;
  void import("@/native/appBadge").then((m) => m.clearAppBadge()).catch((): void => undefined); // BI_CLIENT_BLOCK_v551_APP_BADGE
  void import("@/native/clientWidget").then((m) => m.clearClientWidget()).catch((): void => undefined); // BI_CLIENT_BLOCK_v603_HOME_WIDGET
  // BI_CLIENT_BACKGROUND_SYNC_v308 - stop anything the phone was still sending.
  void import("@/native/backgroundSync").then((m) => m.cancelBackgroundSync()).catch((): void => undefined);
  // BI_CLIENT_OFFLINE_v302 - cached screens and unsent saves belong to this applicant only.
  void import("@/offline/offlineStore").then((m) => m.clearOfflineData()).catch((): void => undefined);
  if (native()) {
    // Do not erase the entire Keychain domain: it also holds the Face ID
    // sign-in secret. Remove only this applicant session.
    await Promise.allSettled([
      SecureStorage.remove(APPLICANT_TOKEN_KEY),
      Preferences.remove({ key: PHONE_KEY }),
    ]);
  } else {
    localStorage.removeItem(APPLICANT_TOKEN_KEY);
    localStorage.removeItem(PHONE_KEY);
  }
}
