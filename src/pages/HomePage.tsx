// BI_CLIENT_SCAFFOLD_v1 - placeholder. The contract upload and the extracted
// requirement list land here next.
import { useEffect, useState } from "react";
import { enablePushAfterSignIn } from "@/native/pushNotifications"; // BI_CLIENT_PUSH_OPT_IN_v241
import { useNavigate } from "react-router-dom";
import { clearToken } from "@/auth/token";
import { apiRequest } from "@/api/client";
import ActionCenter from "@/components/ActionCenter"; // BI_CLIENT_NATIVE_WIRING_v237
import ApplicationProgress from "@/components/ApplicationProgress"; // BI_CLIENT_APPLICATION_PROGRESS_v280

export default function HomePage() {
  const navigate = useNavigate();
  // BI_CLIENT_PUSH_OPT_IN_v241 - signed in, so the token upload can authenticate.
  useEffect(() => { void enablePushAfterSignIn(); }, []);
  // BI_CLIENT_ACCOUNT_DELETE_v1 - store-required in-app account deletion.
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [unreadMessages, setUnreadMessages] = useState(0); // BI_CLIENT_BLOCK_v608

  useEffect(() => {
    let active = true;
    void apiRequest<{ unreadCount?: number }>("/applicants/messages/unread-count")
      .then((result) => { if (active) setUnreadMessages(Math.max(0, result.unreadCount ?? 0)); })
      .catch(() => undefined);
    return () => { active = false; };
  }, []);

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
        {/* BI_CLIENT_APPLICATION_PROGRESS_v280 */}
        <ApplicationProgress />
        {/* BI_CLIENT_NATIVE_WIRING_v237 */}
        <ActionCenter
          applicationId="me"
          onAction={(item, id) => navigate(item.kind === "document" ? `/requirements/${encodeURIComponent(id)}` : `/questions/${encodeURIComponent(id)}`)}
        />
        <div className="bi-card">
      <h1>You are signed in</h1>
      <p className="bi-page__lede">
        Upload your subcontract and we will tell you which coverages it requires.
      </p>
      <button type="button" onClick={() => navigate("/messages")}
        style={{ width: "100%", padding: "12px 16px", fontSize: 16, fontWeight: 600, borderRadius: 8, border: "1px solid #E4EAF2", background: "#fff", color: "#0B1F3A", cursor: "pointer", marginBottom: 16, textAlign: "left", display: "flex", justifyContent: "space-between" }}>
        <span>Messages</span>
        {unreadMessages > 0 && <span aria-label={`${unreadMessages} unread messages`} style={{ minWidth: 24, height: 24, padding: "0 6px", boxSizing: "border-box", borderRadius: "50%", background: "#BF9B49", display: "inline-grid", placeItems: "center", fontSize: 13 }}>{unreadMessages > 99 ? "99+" : unreadMessages}</span>}
      </button>
      <button
        type="button"
        onClick={() => navigate("/upload")}
        style={{ padding: "12px 20px", fontSize: 16, fontWeight: 600, borderRadius: 8, border: "none", background: "#BF9B49", color: "#0B1F3A", cursor: "pointer", marginBottom: 16 }}
      >
        Upload my subcontract
      </button>
      <div />
      {/* BI_CLIENT_ACCOUNT_BAR_v337 - the Face ID row moved to AccountBar, which
          renders on every signed-in screen. This page is reachable again via the
          bar's Account link, and keeps sign-out and account deletion. */}
      <button type="button" onClick={() => { /* BI_CLIENT_FACE_ID_SIGN_IN_v301 */ void import("@/native/deviceSignIn").then((m) => m.disableFaceIdSignIn()).catch((): void => undefined).finally(() => clearToken().finally(() => navigate("/"))); }}
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
