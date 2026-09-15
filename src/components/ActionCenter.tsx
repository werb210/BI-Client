// BI_CLIENT_ACTION_CENTER_v200
// The applicant's outstanding-work panel.
//
// Renders the server's answer verbatim. It does not re-derive completion locally:
// the catalog rules for active and required items and rejected uploads live in
// biApplicantActions.ts on the server, and a second opinion here would drift from
// them the first time one of those rules changes.
import { useCallback, useEffect, useState } from "react";
import { api } from "@/api/client";

type BiActionItem = {
  key: string;
  kind: "document" | "question";
  label: string;
  urgent: boolean;
};

type BiActionCenter = {
  outstanding: BiActionItem[];
  completed: BiActionItem[];
  outstandingCount: number;
  canSubmit: boolean;
};

export default function ActionCenter({ applicationId }: { applicationId: string }) {
  const [data, setData] = useState<BiActionCenter | null>(null);
  const [failed, setFailed] = useState(false);

  const load = useCallback(async () => {
    if (!applicationId) return;
    try {
      setData(await api.get<BiActionCenter>(`/applicants/action-center/${encodeURIComponent(applicationId)}`));
      setFailed(false);
    } catch {
      // Never blank the page the applicant is working on.
      setFailed(true);
    }
  }, [applicationId]);

  useEffect(() => { void load(); }, [load]);

  useEffect(() => {
    const onFocus = () => void load();
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [load]);

  if (failed || !data) return null;
  const { outstanding, completed } = data;
  if (outstanding.length === 0 && completed.length === 0) return null;

  return (
    <div data-testid="bi-action-center" style={{ border: "1px solid rgba(11,31,58,0.12)", borderRadius: 12, background: "#fff", padding: "18px 20px", marginBottom: 20 }}>
      {outstanding.length > 0 ? (
        <>
          <div style={{ fontSize: 18, fontWeight: 600, color: "#0B1F3A" }}>What you need to do</div>
          <div style={{ fontSize: 14, color: "rgba(11,31,58,0.65)", marginTop: 4, marginBottom: 14 }}>
            {outstanding.length} item{outstanding.length === 1 ? "" : "s"} remaining
          </div>
          {outstanding.map((item, i) => (
            <div key={item.key} style={{ display: "flex", alignItems: "flex-start", gap: 12, padding: "10px 0", borderTop: i === 0 ? "none" : "1px solid rgba(11,31,58,0.08)" }}>
              <span style={{ width: 22, height: 22, flexShrink: 0, borderRadius: "50%", marginTop: 1, background: item.urgent ? "rgba(176,0,32,0.12)" : "rgba(11,31,58,0.08)", color: item.urgent ? "#B00020" : "rgba(11,31,58,0.7)", fontSize: 12, fontWeight: 600, display: "flex", alignItems: "center", justifyContent: "center" }}>{i + 1}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 15, color: "#0B1F3A" }}>{item.label}</div>
                {item.urgent && <div style={{ fontSize: 13, color: "#B00020", marginTop: 2 }}>Needs re-uploading — the last one was not accepted</div>}
              </div>
            </div>
          ))}
        </>
      ) : (
        <div style={{ fontSize: 16, fontWeight: 600, color: "#1B7F4B" }}>Nothing outstanding — we have everything we asked for.</div>
      )}
      {completed.length > 0 && (
        <div style={{ marginTop: outstanding.length > 0 ? 18 : 12 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: "rgba(11,31,58,0.6)", marginBottom: 6 }}>Completed</div>
          {completed.map((item) => (
            <div key={item.key} style={{ fontSize: 14, color: "rgba(11,31,58,0.65)", padding: "3px 0" }}><span style={{ color: "#1B7F4B", marginRight: 8 }}>✓</span>{item.label}</div>
          ))}
        </div>
      )}
    </div>
  );
}
