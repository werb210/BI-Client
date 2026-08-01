// BI_CLIENT_SCAFFOLD_v1 - placeholder. The contract upload and the extracted
// requirement list land here next.
import { useNavigate } from "react-router-dom";
import { clearToken } from "@/auth/token";

export default function HomePage() {
  const navigate = useNavigate();
  return (
    <div style={{ maxWidth: 560, margin: "0 auto", padding: 24 }}>
      <h1 style={{ fontSize: 22 }}>You are signed in</h1>
      <p style={{ color: "#475569", fontSize: 14 }}>
        Upload your subcontract and we will tell you which coverages it requires.
      </p>
      <button
        type="button"
        onClick={() => navigate("/upload")}
        style={{ padding: "12px 20px", fontSize: 16, fontWeight: 600, borderRadius: 8, border: "none", background: "#1E3A8A", color: "#fff", cursor: "pointer", marginBottom: 16 }}
      >
        Upload my subcontract
      </button>
      <div />
      <button type="button" onClick={() => { clearToken(); navigate("/"); }}
        style={{ background: "none", border: "none", color: "#1E3A8A", cursor: "pointer", padding: 0, fontSize: 14 }}>
        Sign out
      </button>
    </div>
  );
}
