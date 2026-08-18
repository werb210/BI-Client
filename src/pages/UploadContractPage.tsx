// BI_CLIENT_CONTRACT_UPLOAD_v1
import { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { uploadContract } from "@/api/contract";
import { ApiError } from "@/api/client";
import BackBar from "@/components/BackBar";

const ACCEPT = ".pdf,.doc,.docx,.png,.jpg,.jpeg";
const MAX_BYTES = 25 * 1024 * 1024;

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

// BI_CLIENT_SHELL_v20 - width and ground come from chrome.css. No outer card
// here: this page composes its own panels, and nesting them reads badly.
const wrap: React.CSSProperties = {};
const drop: React.CSSProperties = {
  border: "2px dashed #E4EAF2", borderRadius: 8, padding: 32,
  textAlign: "center", cursor: "pointer", background: "#F5F8FC", marginTop: 16,
};
const button: React.CSSProperties = {
  padding: "12px 20px", fontSize: 16, fontWeight: 600, borderRadius: 8,
  border: "none", background: "#BF9B49", color: "#0B1F3A", cursor: "pointer",
};

export default function UploadContractPage() {
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function send(file: File) {
    if (file.size > MAX_BYTES) {
      setError("That file is over 25 MB. Please upload a smaller copy.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const result = await uploadContract(file);
      // BI_CLIENT_FLOW_v12 - the subcontract is the only document we ask for.
      navigate(`/requirements/${result.applicationId}`);
    } catch (err) {
      setError(message(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="bi-page" style={wrap}>
      <div className="bi-page__inner">
      <BackBar to="/start" />
      <h1>Upload your subcontract</h1>
      <p className="bi-page__lede">
        We will read the insurance and bonding clauses and show you what the contract
        asks for. You will get a chance to check each one before anything happens.
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
        <div style={{ fontWeight: 600, marginBottom: 6 }}>
          {busy ? "Reading your contract…" : "Choose a file or drop it here"}
        </div>
        <div style={{ fontSize: 13, color: "#8593aa" }}>PDF, Word or a photo. Up to 25 MB.</div>
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPT}
          data-testid="contract-file-input"
          style={{ display: "none" }}
          disabled={busy}
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void send(f);
            e.currentTarget.value = "";
          }}
        />
      </div>
      {error && <div style={{ color: "#b91c1c", fontSize: 13, marginTop: 12 }}>{error}</div>}
      <div style={{ marginTop: 20 }}>
        <button type="button" style={button} disabled={busy} onClick={() => inputRef.current?.click()}>
          {busy ? "Reading…" : "Choose file"}
        </button>
      </div>
      {/* BI_CLIENT_COVERAGE_v4 - plenty of subcontractors are quoting before
          they hold a signed contract. Without this the flow dead-ends for them. */}
      <div style={{ marginTop: 20 }}>
        <button type="button" disabled={busy} onClick={() => navigate("/coverage/me")}
          style={{ background: "none", border: "none", color: "#0B1F3A", cursor: "pointer",
                   padding: 0, fontSize: 14, textDecoration: "underline", minHeight: 44 }}>
          I do not have a subcontract yet
        </button>
      </div>
    </div>
    </div>
  );
}
