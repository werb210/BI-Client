import { useCallback, useEffect, useState } from "react";
import { Capacitor } from "@capacitor/core";
import { BiometricAuth } from "@aparajita/capacitor-biometric-auth";
import { getCachedToken } from "@/auth/token";

// BI_CLIENT_BIOMETRIC_SCANNER_WIRE_v1 - Face ID / Touch ID re-entry over the applicant session.
const SESSION_KEY = "boreal_bi_applicant_token";

function hasSession(): boolean {
  // Native applicant tokens live in secure storage and are exposed only through
  // the in-memory cache populated by restoreToken. The localStorage lookup keeps
  // this helper safe if it is evaluated while running as a browser application.
  if (Capacitor.isNativePlatform()) return Boolean(getCachedToken());
  try { return Boolean(window.localStorage.getItem(SESSION_KEY)); } catch { return false; }
}

export function useBiometricLock() {
  const [locked, setLocked] = useState(false);

  const evaluate = useCallback(async () => {
    if (!Capacitor.isNativePlatform() || !hasSession()) {
      setLocked(false);
      return;
    }
    try {
      const info = await BiometricAuth.checkBiometry();
      setLocked(Boolean(info.isAvailable));
    } catch {
      setLocked(false);
    }
  }, []);

  const unlock = useCallback(async () => {
    try {
      await BiometricAuth.authenticate({
        reason: "Unlock Boreal Risk Management",
        cancelTitle: "Cancel",
        allowDeviceCredential: true,
        iosFallbackTitle: "Use passcode",
      });
      setLocked(false);
      return true;
    } catch {
      return false;
    }
  }, []);

  useEffect(() => {
    void evaluate();
    const onResume = () => { void evaluate(); };
    window.addEventListener("boreal:native-resume", onResume);
    return () => window.removeEventListener("boreal:native-resume", onResume);
  }, [evaluate]);

  return { locked, unlock };
}
