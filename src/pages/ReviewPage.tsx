import BackBar from "@/components/BackBar"; // BI_CLIENT_FLOW_v12
// BI_CLIENT_REVIEW_v7 - step 4. Finishing the questions used to land on the
// contract-requirements page, which says "we did not find any insurance
// clauses" to anyone who never uploaded a contract and offers nothing to do
// next. This is the actual end of the flow.
import { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { getSummary, submitApplication, type Summary } from "@/api/summary";

const wrap: React.CSSProperties = { maxWidth: 680, margin: "0 auto", padding: 24, paddingBottom: 120 };
const card: React.CSSProperties = {
  border: "1px solid #E4EAF2", borderRadius: 12, padding: 18, marginBottom: 16, background: "#fff",
};
const h2: React.CSSProperties = { fontSize: 15, fontWeight: 600, margin: "0 0 12px", color: "#0B1F3A" };
const line: React.CSSProperties = { fontSize: 14, color: "#0B1F3A", padding: "6px 0" };
const bar: React.CSSProperties = {
  position: "fixed", left: 0, right: 0, bottom: 0, padding: 16,
  background: "#fff", borderTop: "1px solid #E4EAF2", display: "flex", gap: 12,
};
const cta: React.CSSProperties = {
  flex: 1, minHeight: 56, fontSize: 16, fontWeight: 600, borderRadius: 10,
  border: "none", background: "#BF9B49", color: "#0B1F3A", cursor: "pointer",
};
const ghost: React.CSSProperties = {
  minHeight: 56, padding: "0 20px", fontSize: 16, borderRadius: 10,
  border: "1px solid #E4EAF2", background: "#fff", color: "#0B1F3A", cursor: "pointer",
};

export default function ReviewPage() {
  const { applicationId = "" } = useParams();
  const navigate = useNavigate();
  const [s, setS] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const data = await getSummary(applicationId);
      setS(data);
      if (data.status === "ready_for_submission") setDone(true);
    } catch {
      setError("We could not load your application. Please refresh.");
    } finally {
      setLoading(false);
    }
  }, [applicationId]);

  useEffect(() => { void load(); }, [load]);

  async function submit() {
    if (busy || !s) return;
    setBusy(true);
    setError(null);
    try {
      const out = await submitApplication(s.applicationId);
      setS(out);
      setDone(true);
      window.scrollTo(0, 0);
    } catch {
      // The server is the authority on completeness, so re-read rather than
      // guessing which gate failed.
      setError("We could not submit yet. Please check the items below.");
      void load();
      setBusy(false);
    }
  }

  if (loading) return <div style={wrap}>Loading…</div>;
  if (!s) return <div style={wrap}>{error ?? "Not found."}</div>;

  if (done) {
    return (
      <div style={wrap}>
        <h1 style={{ fontSize: 24, marginBottom: 8 }}>That's everything we need</h1>
        <p style={{ color: "#51617D", fontSize: 15, marginTop: 0 }}>
          Your application is with our team. We will text you at the number you verified
          as soon as there is news, usually within one business day.
        </p>
        <div style={card}>
          <div style={h2}>Reference</div>
          <div style={line}>{s.applicationId}</div>
        </div>
        <div style={card}>
          <div style={h2}>Coverage requested</div>
          {s.coverages.map((c) => <div key={c.code} style={line}>{c.display_name}</div>)}
          {s.referrals.length > 0 && (
            <>
              <div style={{ ...h2, marginTop: 12 }}>Being referred out</div>
              {s.referrals.map((r) => <div key={r.coverage_code} style={line}>{r.display_name}</div>)}
            </>
          )}
        </div>
      </div>
    );
  }

  return (
    <div style={wrap}>
      <BackBar />
      <h1 style={{ fontSize: 24, marginBottom: 4 }}>Check this over</h1>
      <p style={{ color: "#51617D", fontSize: 14, marginTop: 0, marginBottom: 20 }}>
        Nothing is sent until you press submit.
      </p>

      <div style={card}>
        <div style={h2}>Your details</div>
        <div style={line}>{s.businessName ?? "—"}</div>
        <div style={line}>{s.applicantName ?? "—"}</div>
        <div style={line}>{s.email ?? "—"}</div>
        <div style={line}>{s.country === "US" ? "United States" : "Canada"}</div>
      </div>

      {/* BI_CLIENT_REFERRAL_v8 - keep coverages we cannot place separate from
          quoted lines so the applicant knows what will happen next. */}
      {s.referrals.length > 0 && (
        <div style={{ ...card, borderColor: "#fde68a", background: "#fffbeb" }}>
          <div style={h2}>Being referred out ({s.referrals.length})</div>
          <div style={{ ...line, color: "#78350f" }}>
            Your contract asks for these and we do not place them in
            {s.country === "US" ? " the United States" : " Canada"} ourselves.
            Our team will find you a market and come back to you.
          </div>
          {s.referrals.map((r) => (
            <div key={r.coverage_code} style={line}>{r.display_name}</div>
          ))}
        </div>
      )}

      <div style={card}>
        <div style={h2}>Coverage requested ({s.coverages.length})</div>
        {s.coverages.length === 0 && <div style={line}>Nothing selected yet.</div>}
        {s.coverages.map((c) => (
          <div key={c.code} style={line}>
            {c.display_name}
            {c.source === "contract" && (
              <span style={{ color: "#8593aa", fontSize: 12 }}> — required by your contract</span>
            )}
          </div>
        ))}
        <button type="button" style={{ ...ghost, minHeight: 44, marginTop: 12 }}
          onClick={() => navigate(`/coverage/${encodeURIComponent(s.applicationId)}`)}>
          Change coverage
        </button>
      </div>

      <div style={card}>
        <div style={h2}>Documents</div>
        {s.documents.length === 0
          ? <div style={line}>None uploaded. That is fine — we can ask later if we need one.</div>
          : s.documents.map((d, i) => <div key={i} style={line}>{d.original_filename}</div>)}
        <button type="button" style={{ ...ghost, minHeight: 44, marginTop: 12 }} onClick={() => navigate("/upload")}>
          Upload a document
        </button>
      </div>

      <div style={card}>
        <div style={h2}>Questions</div>
        <div style={line}>{s.answered} answered</div>
        {s.outstanding.length > 0 && (
          <>
            <div style={{ ...line, color: "#b91c1c" }}>{s.outstanding.length} still needs an answer:</div>
            {s.outstanding.slice(0, 5).map((o) => (
              <div key={o.questionKey} style={{ ...line, color: "#b91c1c", fontSize: 13 }}>• {o.prompt}</div>
            ))}
            <button type="button" style={{ ...ghost, minHeight: 44, marginTop: 12 }}
              onClick={() => navigate(`/questions/${encodeURIComponent(s.applicationId)}`)}>
              Finish the questions
            </button>
          </>
        )}
      </div>

      {error && <div style={{ color: "#b91c1c", fontSize: 14 }}>{error}</div>}
      <div style={bar}>
        <button type="button" style={{ ...cta, opacity: s.canSubmit && !busy ? 1 : 0.5 }}
          disabled={!s.canSubmit || busy} onClick={() => void submit()}>
          {busy ? "Submitting..." : s.canSubmit ? "Submit my application" : "Finish the items above"}
        </button>
      </div>
    </div>
  );
}
