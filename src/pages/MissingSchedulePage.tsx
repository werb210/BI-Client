// BI_CLIENT_MISSING_SCHEDULE_v10
// A real EllisDon subcontract carries no coverage limits at all. Section 35.2
// defers the entire insurance schedule to "Schedule I - Insurance", which ships
// as a separate PDF. An applicant who uploads only the agreement used to land on
// the requirements page and read "we did not find any insurance clauses", which
// sounds like their contract has none. It has plenty - in another file.
//
// So ask for that file by name. One question, one control, and a way past it,
// because plenty of subcontractors will not have the schedule to hand and must
// not be trapped here.
import { useRef, useState } from "react";
import { useNavigate, useParams, useLocation } from "react-router-dom";
import { uploadContract, type MissingSchedule } from "@/api/contract";
import { ApiError } from "@/api/client";

const wrap: React.CSSProperties = { maxWidth: 560, margin: "0 auto", padding: 24 };
const drop: React.CSSProperties = {
  border: "2px dashed #cbd5e1", borderRadius: 12, padding: 32,
  textAlign: "center", cursor: "pointer", background: "#f8fafc", marginTop: 16,
};
// 56px minimum touch target and 16px type throughout: this flow is overwhelmingly
// used on a phone, and anything under 16px makes iOS zoom the page on focus.
const primary: React.CSSProperties = {
  minHeight: 56, padding: "0 24px", fontSize: 16, fontWeight: 600, borderRadius: 8,
  border: "none", background: "#1E3A8A", color: "#fff", cursor: "pointer", width: "100%",
};
const skip: React.CSSProperties = {
  background: "none", border: "none", color: "#1E3A8A", cursor: "pointer",
  padding: 0, fontSize: 16, textDecoration: "underline", minHeight: 56,
};

function message(err: unknown): string {
  const code = err instanceof ApiError ? err.code : "";
  if (code === "unsupported_file_type") return "We can read PDF, Word and photos. Please try one of those.";
  if (code === "file_too_large") return "That file is over 25 MB. Please upload a smaller copy.";
  if (code === "no_text_found") {
    return "We could not read any text from that file. If it is a scan, a clearer copy or the original PDF usually works.";
  }
  if (err instanceof ApiError && err.status === 401) return "Your session expired. Please sign in again.";
  return "That upload did not go through. Please try again.";
}

export default function MissingSchedulePage() {
  const { applicationId = "" } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const missing = ((location.state as { missingSchedules?: MissingSchedule[] } | null)
    ?.missingSchedules ?? []) as MissingSchedule[];
  const named = missing[0];
  // Name the exact document when we know it. "Schedule I: Insurance" is far
  // easier to find in an email thread than "your insurance requirements".
  const label = named ? `${named.ref}: ${named.title}` : "the insurance schedule";

  const onwards = () => navigate(`/requirements/${encodeURIComponent(applicationId)}`);

  async function send(file: File) {
    setBusy(true);
    setError(null);
    try {
      await uploadContract(file);
      onwards();
    } catch (err) {
      setError(message(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={wrap}>
      <h1 style={{ fontSize: 22, marginBottom: 4 }}>We need one more document</h1>
      <p style={{ color: "#475569", fontSize: 16, marginTop: 0 }}>
        Your subcontract does not set out the insurance itself. It points to{" "}
        <strong data-testid="missing-schedule-label">{label}</strong>, which comes as a
        separate file. That is where the coverages and the limits live, so we cannot
        tell you what you need without it.
      </p>
      <div
        style={drop}
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          const f = e.dataTransfer.files?.[0];
          if (f) void send(f);
        }}
      >
        <div style={{ fontWeight: 600, marginBottom: 6, fontSize: 16 }}>
          {busy ? "Reading it now…" : `Upload ${label}`}
        </div>
        <div style={{ fontSize: 16, color: "#64748b" }}>PDF, Word or a photo. Up to 25 MB.</div>
        <input
          ref={inputRef}
          type="file"
          accept=".pdf,.doc,.docx,.png,.jpg,.jpeg"
          data-testid="schedule-file-input"
          style={{ display: "none" }}
          disabled={busy}
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void send(f);
            e.currentTarget.value = "";
          }}
        />
      </div>
      {error && <div style={{ color: "#b91c1c", fontSize: 16, marginTop: 12 }}>{error}</div>}
      <div style={{ marginTop: 20 }}>
        <button type="button" style={primary} disabled={busy} onClick={() => inputRef.current?.click()}>
          {busy ? "Reading…" : "Choose file"}
        </button>
      </div>
      {/* Not having the schedule is common and is not a dead end. Choosing
          coverage by hand still gets the applicant a quote. */}
      <div style={{ marginTop: 20 }}>
        <button type="button" style={skip} disabled={busy} data-testid="skip-schedule" onClick={onwards}>
          I do not have that document
        </button>
      </div>
    </div>
  );
}
