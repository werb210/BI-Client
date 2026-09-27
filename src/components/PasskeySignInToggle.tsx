// BI_CLIENT_BLOCK_v602 - passkey enrollment lives beside the other account controls.
import { useState } from "react";
import { createPasskey, passkeysSupported, PasskeyError } from "@/auth/passkeys";

export default function PasskeySignInToggle() {
  const [busy, setBusy] = useState(false);
  const [created, setCreated] = useState(false);
  const [error, setError] = useState<string | null>(null);
  if (!passkeysSupported) return null;

  const turnOn = async () => {
    setBusy(true);
    setError(null);
    try {
      await createPasskey();
      setCreated(true);
    } catch (reason) {
      setError(reason instanceof PasskeyError ? reason.message : "Boreal could not create a passkey. Try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div data-testid="passkey-sign-in-setting" style={{ margin: "12px 0", display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
      <span style={{ fontSize: 14, color: "#0B1F3A", fontWeight: 600 }}>Passkey sign-in</span>
      {created ? <span style={{ fontSize: 14, color: "#1B7F3B", fontWeight: 600 }}>Ready</span> : (
        <button type="button" disabled={busy} onClick={() => void turnOn()} style={{ padding: "8px 14px", borderRadius: 8, border: "none", background: busy ? "#9AA5B1" : "#BF9B49", color: "#0B1F3A", fontSize: 14, fontWeight: 600, cursor: busy ? "default" : "pointer" }}>
          {busy ? "Creating…" : "Create a passkey"}
        </button>
      )}
      {error && <span style={{ fontSize: 13, color: "#B00020", width: "100%" }}>{error}</span>}
    </div>
  );
}
