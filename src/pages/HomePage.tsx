// BI_CLIENT_SCAFFOLD_v1 - placeholder. The contract upload and the extracted
// requirement list land here next.
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { clearToken } from "@/auth/token";
import { apiRequest } from "@/api/client";

export default function HomePage() {
  const navigate = useNavigate();
  // BI_CLIENT_ACCOUNT_DELETE_v1 - store-required in-app account deletion.
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function deleteAccount() {
    setDeleting(true);
    setError(null);
    try {
      await apiRequest("/applicants/account/delete", { method: "POST" });
      await clearToken();
      navigate("/");
    } catch {
      setError("Could not delete your account. Please try again or contact support.");
      setDeleting(false);
    }
  }

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
      <button type="button" onClick={() => { void clearToken().finally(() => navigate("/")); }}
        style={{ background: "none", border: "none", color: "#0B1F3A", cursor: "pointer", padding: 0, fontSize: 14 }}>
        Sign out
      </button>

      {/* BI_CLIENT_ACCOUNT_DELETE_v1 - permanent deletion of the applicant's own
          application(s). Two-step confirm so it can't be hit by accident. */}
      <div style={{ marginTop: 28, paddingTop: 16, borderTop: "1px solid rgba(11,31,58,0.12)" }}>
        {!confirming ? (
          <button type="button" onClick={() => { setError(null); setConfirming(true); }}
            style={{ background: "none", border: "none", color: "#B00020", cursor: "pointer", padding: 0, fontSize: 14 }}>
            Delete my account
          </button>
        ) : (
          <div>
            <p style={{ margin: "0 0 10px", fontSize: 14, color: "#0B1F3A" }}>
              This permanently deletes your application and uploaded documents. This cannot be undone.
            </p>
            <button type="button" disabled={deleting} onClick={() => void deleteAccount()}
              style={{ padding: "10px 16px", fontSize: 14, fontWeight: 600, borderRadius: 8, border: "none", background: "#B00020", color: "#fff", cursor: "pointer", marginRight: 12, opacity: deleting ? 0.6 : 1 }}>
              {deleting ? "Deleting…" : "Yes, delete everything"}
            </button>
            <button type="button" disabled={deleting} onClick={() => setConfirming(false)}
              style={{ background: "none", border: "none", color: "#0B1F3A", cursor: "pointer", padding: 0, fontSize: 14 }}>
              Cancel
            </button>
          </div>
        )}
        {error && <p style={{ marginTop: 10, fontSize: 13, color: "#B00020" }}>{error}</p>}
      </div>
        </div>
      </div>
    </div>
  );
}
