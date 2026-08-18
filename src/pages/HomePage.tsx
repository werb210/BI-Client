// BI_CLIENT_SCAFFOLD_v1 - placeholder. The contract upload and the extracted
// requirement list land here next.
import { useNavigate } from "react-router-dom";
import { clearToken } from "@/auth/token";

export default function HomePage() {
  const navigate = useNavigate();
  return (
    // BI_CLIENT_SHELL_v19 - shared shell; width and card come from chrome.css.
    <div className="bi-page">
      <div className="bi-page__inner bi-page__inner--narrow">
        <div className="bi-card">
      <h1>You are signed in</h1>
      <p className="bi-page__lede">
        Upload your subcontract and we will tell you which coverages it requires.
      </p>
      <button
        type="button"
        onClick={() => navigate("/upload")}
        style={{ padding: "12px 20px", fontSize: 16, fontWeight: 600, borderRadius: 8, border: "none", background: "#BF9B49", color: "#0B1F3A", cursor: "pointer", marginBottom: 16 }}
      >
        Upload my subcontract
      </button>
      <div />
      <button type="button" onClick={() => { clearToken(); navigate("/"); }}
        style={{ background: "none", border: "none", color: "#0B1F3A", cursor: "pointer", padding: 0, fontSize: 14 }}>
        Sign out
      </button>
        </div>
      </div>
    </div>
  );
}
