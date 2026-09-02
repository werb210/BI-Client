// BI_CLIENT_SCAFFOLD_v1
import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { startOtp, verifyOtp } from "@/api/otp";
import { ApiError } from "@/api/client";
import { consumeNativeDestination } from "@/native/deepLinks";

function message(err: unknown): string {
  const code = err instanceof ApiError ? err.code : "";
  if (code === "otp_rate_limited") return "Too many attempts. Request a new code in about 10 minutes.";
  if (code === "invalid_otp") return "That code was not right. Check it and try again.";
  if (code === "invalid_phone") return "That does not look like a mobile number.";
  if (code === "otp_verify_failed") return "We could not check that code just now. Please try again.";
  return "Something went wrong. Please try again.";
}

// BI_CLIENT_SHELL_v18 - layout comes from chrome.css now, so the width matches
// every other page in the flow instead of being the narrowest of four.
const wrap: React.CSSProperties = {};
// BI_CLIENT_FIELD_v22 - was ~44px where every later field is 56. Now the
// shared class, so the first field a user touches matches the rest.
const input: React.CSSProperties = { marginTop: 6 };
const button: React.CSSProperties = { width: "100%", marginTop: 14, padding: "12px 16px", fontSize: 16, fontWeight: 600, borderRadius: 8, border: "none", background: "#BF9B49", color: "#0B1F3A", cursor: "pointer" };

export default function SignInPage() {
  const navigate = useNavigate();
  const [phase, setPhase] = useState<"phone" | "code">("phone");
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const sentFor = useRef("");
  const checkedFor = useRef("");
  const digits = (value: string) => value.replace(/\D/g, "");

  useEffect(() => {
    if (phase !== "phone" || busy) return;
    const d = digits(phone);
    if (d.length < 10 || d.length > 15) return;
    if (sentFor.current === d) return;
    sentFor.current = d;
    void send();
  }, [phone, phase, busy]);

  useEffect(() => {
    if (phase !== "code" || busy) return;
    const d = digits(code);
    if (d.length !== 6) return;
    if (checkedFor.current === d) return;
    checkedFor.current = d;
    void check();
  }, [code, phase, busy]);

  async function send() {
    setBusy(true);
    setError(null);
    try {
      await startOtp(phone);
      setPhase("code");
    } catch (err) {
      sentFor.current = ""; // let a corrected number try again
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
      // BI_CLIENT_STEP1_PROFILE_v3 - sign-in lands on step 1, not the stub home.
      navigate(consumeNativeDestination() ?? "/start");
    } catch (err) {
      checkedFor.current = ""; // a mistyped code must be retryable
      setError(message(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="bi-page">
      <div className="bi-page__inner bi-page__inner--narrow">
        <div className="bi-card" style={wrap}>
      <h1 style={{ fontSize: 22, marginBottom: 4 }}>Boreal Risk Management</h1>
      <p style={{ color: "#51617D", fontSize: 14, marginTop: 0 }}>
        Sign in with your mobile number. We will text you a code.
      </p>

      {phase === "phone" ? (
        <>
          <label style={{ fontSize: 13 }}>
            Mobile number
            <input type="tel" name="tel" inputMode="tel" autoComplete="tel" value={phone}
              onChange={(e) => setPhone(e.target.value)} className="bi-field" style={input} />
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
              onChange={(e) => setCode(e.target.value)} className="bi-field" style={input} />
          </label>
          <button type="button" style={button} disabled={busy || code.trim().length < 6} onClick={() => void check()}>
            {busy ? "Checking\u2026" : "Sign in"}
          </button>
          <button type="button" onClick={() => { setPhase("phone"); setCode(""); setError(null); sentFor.current = ""; checkedFor.current = ""; }}
            style={{ marginTop: 12, background: "none", border: "none", color: "#0B1F3A", cursor: "pointer", padding: 0, fontSize: 14 }}>
            Use a different number
          </button>
        </>
      )}

          {error && <div style={{ color: "#b91c1c", fontSize: 13, marginTop: 12 }}>{error}</div>}
        </div>
      </div>
    </div>
  );
}
