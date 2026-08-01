// BI_CLIENT_CONTRACT_UPLOAD_v1
import { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { uploadContract } from "@/api/contract";
import { ApiError } from "@/api/client";

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

const wrap: React.CSSProperties = { maxWidth: 560, margin: "0 auto", padding: 24 };
const drop: React.CSSProperties = {
  border: "2px dashed #cbd5e1", borderRadius: 12, padding: 32,
  textAlign: "center", cursor: "pointer", background: "#f8fafc", marginTop: 16,
};
const button: React.CSSProperties = {
  padding: "12px 20px", fontSize: 16, fontWeight: 600, borderRadius: 8,
  border: "none", background: "#1E3A8A", color: "#fff", cursor: "pointer",
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
      navigate(`/requirements/${result.applicationId}`);
    } catch (err) {
      setError(message(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={wrap}>
      <h1 style={{ fontSize: 22, marginBottom: 4 }}>Upload your subcontract</h1>
      <p style={{ color: "#475569", fontSize: 14, marginTop: 0 }}>
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
        <div style={{ fontSize: 13, color: "#64748b" }}>PDF, Word or a photo. Up to 25 MB.</div>
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
    </div>
  );
}
