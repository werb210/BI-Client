import { useCallback, useEffect, useRef, useState } from "react";
import { Capacitor } from "@capacitor/core";
import { BiometricAuth } from "@aparajita/capacitor-biometric-auth";
import { getCachedToken } from "@/auth/token";
import { ENV } from "@/env";
import { isEnrolled, refreshSessionForBackground } from "@/native/deviceSignIn";

// BI_CLIENT_BIOMETRIC_SCANNER_WIRE_v1 - Face ID / Touch ID re-entry over the applicant session.
//
// BI_CLIENT_LOCK_SESSION_v313 - an applicant session lasts one hour. The lock
// asked for Face ID and then let the app carry on with an expired session, so
// the first screen was refused and the applicant landed on the text-code page.
// Now, after a successful unlock, an expired or nearly expired session is
// renewed with the Face ID sign-in credential (v301). Without that credential an
// expired session is not locked at all - the applicant signs in instead. The
// lock also only re-engages after the app has really been away for a minute.
const SESSION_KEY = "boreal_bi_applicant_token";
export const LOCK_AFTER_MS = 60_000;
const RENEW_WITHIN_MS = 5 * 60_000;

function hasSession(): boolean {
  if (Capacitor.isNativePlatform()) return Boolean(getCachedToken());
  try { return Boolean(window.localStorage.getItem(SESSION_KEY)); } catch { return false; }
}

export function tokenExpiresWithin(token: string | null, ms: number, now = Date.now()): boolean {
  if (!token) return true;
  try {
    const payload = JSON.parse(atob(token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/"))) as { exp?: number };
    return typeof payload.exp !== "number" || payload.exp * 1000 - now <= ms;
  } catch {
    return true;
  }
}

export function shouldLock(p: { session: boolean; sessionUsable: boolean; enrolled: boolean; biometry: boolean; coldStart: boolean; backgroundedAt: number | null; now: number }): boolean {
  if (!p.session || !p.biometry) return false;
  // BI_CLIENT_LOCK_ONLY_ENROLLED_v330 - never prompt applicants who did not enroll.
  if (!p.enrolled) return false;
  if (p.coldStart) return true;
  return p.backgroundedAt !== null && p.now - p.backgroundedAt >= LOCK_AFTER_MS;
}

export function useBiometricLock() {
  const [locked, setLocked] = useState(false);
  // BI_CLIENT_LOCK_ORDER_v363 - nothing renders until the first check has decided.
  const [ready, setReady] = useState(!Capacitor.isNativePlatform());
  const coldStart = useRef(true);
  const backgroundedAt = useRef<number | null>(null);

  const evaluate = useCallback(async () => {
    const isColdStart = coldStart.current;
    coldStart.current = false;
    const awayAt = backgroundedAt.current;
    backgroundedAt.current = null;
    if (!Capacitor.isNativePlatform() || !hasSession()) { setLocked(false); setReady(true); return; }
    let biometry = false;
    try { biometry = Boolean((await BiometricAuth.checkBiometry()).isAvailable); } catch { biometry = false; }
    const enrolled = await isEnrolled().catch(() => false);
    const lock = shouldLock({
      session: true,
      sessionUsable: !tokenExpiresWithin(getCachedToken(), 0),
      enrolled,
      biometry,
      coldStart: isColdStart,
      backgroundedAt: awayAt,
      now: Date.now(),
    });
    if (lock) setLocked(true);
    setReady(true);
  }, []);

  const unlock = useCallback(async () => {
    try {
      await BiometricAuth.authenticate({
        reason: "Unlock Boreal Risk Management",
        cancelTitle: "Cancel",
        allowDeviceCredential: true,
        iosFallbackTitle: "Use passcode",
      });
      // The applicant just passed Face ID: renew a session that has run out.
      if (tokenExpiresWithin(getCachedToken(), RENEW_WITHIN_MS) && (await isEnrolled().catch(() => false))) {
        await refreshSessionForBackground(`${ENV.API_BASE}${ENV.API_PREFIX}`);
        window.dispatchEvent(new Event("boreal:session-renewed")); // BI_CLIENT_LOCK_ORDER_v363
      }
      setLocked(false);
      return true;
    } catch {
      return false;
    }
  }, []);

  useEffect(() => {
    void evaluate();
    const onResume = () => { void evaluate(); };
    const onPause = () => { if (backgroundedAt.current === null) backgroundedAt.current = Date.now(); };
    window.addEventListener("boreal:native-resume", onResume);
    window.addEventListener("boreal:native-pause", onPause);
    return () => {
      window.removeEventListener("boreal:native-resume", onResume);
      window.removeEventListener("boreal:native-pause", onPause);
    };
  }, [evaluate]);

  return { locked, ready, unlock };
}
