// BI_CLIENT_SCAFFOLD_v1
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { startOtp, verifyOtp } from "@/api/otp";
import { ApiError } from "@/api/client";

function message(err: unknown): string {
  const code = err instanceof ApiError ? err.code : "";
  if (code === "otp_rate_limited") return "Too many attempts. Request a new code in about 10 minutes.";
  if (code === "invalid_otp") return "That code was not right. Check it and try again.";
  if (code === "invalid_phone") return "That does not look like a mobile number.";
  if (code === "otp_verify_failed") return "We could not check that code just now. Please try again.";
  return "Something went wrong. Please try again.";
}

const wrap: React.CSSProperties = { maxWidth: 420, margin: "0 auto", padding: 24 };
const input: React.CSSProperties = { width: "100%", padding: "12px 14px", fontSize: 16, borderRadius: 8, border: "1px solid #cbd5e1", boxSizing: "border-box", marginTop: 6 };
const button: React.CSSProperties = { width: "100%", marginTop: 14, padding: "12px 16px", fontSize: 16, fontWeight: 600, borderRadius: 8, border: "none", background: "#1E3A8A", color: "#fff", cursor: "pointer" };

export default function SignInPage() {
  const navigate = useNavigate();
  const [phase, setPhase] = useState<"phone" | "code">("phone");
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function send() {
    setBusy(true);
    setError(null);
    try {
      await startOtp(phone);
      setPhase("code");
    } catch (err) {
      setError(message(err));
    } finally {
      setBusy(false);
    }
  }

  async function check() {
    setBusy(true);
    setError(null);
    try {
      await verifyOtp(phone, code);
      navigate("/home");
    } catch (err) {
      setError(message(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={wrap}>
      <h1 style={{ fontSize: 22, marginBottom: 4 }}>Boreal Risk Management</h1>
      <p style={{ color: "#475569", fontSize: 14, marginTop: 0 }}>
        Sign in with your mobile number. We will text you a code.
      </p>

      {phase === "phone" ? (
        <>
          <label style={{ fontSize: 13 }}>
            Mobile number
            <input type="tel" name="tel" inputMode="tel" autoComplete="tel" value={phone}
              onChange={(e) => setPhone(e.target.value)} style={input} />
          </label>
          <button type="button" style={button} disabled={busy || !phone.trim()} onClick={() => void send()}>
            {busy ? "Sending\u2026" : "Send code"}
          </button>
        </>
      ) : (
        <>
          <label style={{ fontSize: 13 }}>
            6-digit code
            <input inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={code}
              onChange={(e) => setCode(e.target.value)} style={input} />
          </label>
          <button type="button" style={button} disabled={busy || code.trim().length < 6} onClick={() => void check()}>
            {busy ? "Checking\u2026" : "Sign in"}
          </button>
          <button type="button" onClick={() => { setPhase("phone"); setCode(""); setError(null); }}
            style={{ marginTop: 12, background: "none", border: "none", color: "#1E3A8A", cursor: "pointer", padding: 0, fontSize: 14 }}>
            Use a different number
          </button>
        </>
      )}

      {error && <div style={{ color: "#b91c1c", fontSize: 13, marginTop: 12 }}>{error}</div>}
    </div>
  );
}
