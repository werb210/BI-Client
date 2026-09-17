// BI_CLIENT_FACE_ID_SETTING_v330
import { useCallback, useEffect, useState } from "react";
import {
  biometryStatus,
  disableFaceIdSignIn,
  enrollDeviceWithReason,
  HINT_KEY,
  isEnrolled,
  type BiometryStatus,
} from "@/native/deviceSignIn";

type Phase = "checking" | "ready";

export default function FaceIdSignInToggle() {
  const [phase, setPhase] = useState<Phase>("checking");
  const [status, setStatus] = useState<BiometryStatus | null>(null);
  const [enrolled, setEnrolled] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hint, setHint] = useState(false);

  const refresh = useCallback(async () => {
    const nextStatus = await biometryStatus();
    setStatus(nextStatus);
    setEnrolled(nextStatus.native ? await isEnrolled().catch(() => false) : false);
    setPhase("ready");
  }, []);

  useEffect(() => {
    try { setHint(sessionStorage.getItem(HINT_KEY) === "1"); } catch { /* storage unavailable */ }
    void refresh();
  }, [refresh]);

  const clearHint = () => {
    setHint(false);
    try { sessionStorage.removeItem(HINT_KEY); } catch { /* storage unavailable */ }
  };

  const turnOn = async () => {
    setBusy(true);
    setError(null);
    try {
      // BI_CLIENT_ENROLL_REASON_v336 - show the actual reason. A cancelled prompt
      // carries no message, because choosing "Not now" is not an error.
      const result = await enrollDeviceWithReason();
      if (!result.ok && result.message) setError(result.message);
      await refresh();
      clearHint();
    } finally {
      setBusy(false);
    }
  };

  const turnOff = async () => {
    setBusy(true);
    setError(null);
    try {
      await disableFaceIdSignIn();
      await refresh();
      clearHint();
    } catch {
      setError("Face ID could not be turned off. Try again.");
    } finally {
      setBusy(false);
    }
  };

  if (phase === "ready" && status && !status.native) return null;

  const row: React.CSSProperties = { margin: "12px 0", display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" };
  const button: React.CSSProperties = { padding: "8px 14px", borderRadius: 8, border: "none", background: busy ? "#9AA5B1" : "#BF9B49", color: "#0B1F3A", fontSize: 14, fontWeight: 600, cursor: busy ? "default" : "pointer" };
  const link: React.CSSProperties = { padding: 0, border: 0, background: "none", color: "#0B1F3A", fontSize: 14, textDecoration: "underline", cursor: busy ? "default" : "pointer" };

  return (
    <div style={row} data-testid="face-id-setting">
      <span style={{ fontSize: 14, color: "#0B1F3A", fontWeight: 600 }}>Face ID sign-in</span>
      {phase === "checking" && <span style={{ fontSize: 13, color: "#5B6B7F" }}>Checking…</span>}
      {phase === "ready" && status && !status.available && (
        <span style={{ fontSize: 13, color: "#5B6B7F" }} data-testid="face-id-unavailable">Not available — {status.reason}</span>
      )}
      {phase === "ready" && status?.available && !enrolled && (
        <>
          <button type="button" style={button} disabled={busy} onClick={() => void turnOn()}>{busy ? "Turning on…" : "Turn on Face ID sign-in"}</button>
          {hint && <span style={{ fontSize: 13, color: "#5B6B7F" }}>Skip the text code next time.</span>}
        </>
      )}
      {phase === "ready" && status?.available && enrolled && (
        <>
          <span style={{ fontSize: 14, color: "#1B7F3B", fontWeight: 600 }}>On</span>
          <button type="button" style={link} disabled={busy} onClick={() => void turnOff()}>{busy ? "Turning off…" : "Turn off"}</button>
        </>
      )}
      {error && <span style={{ fontSize: 13, color: "#B00020", width: "100%" }}>{error}</span>}
    </div>
  );
}
