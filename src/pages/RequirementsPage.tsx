// BI_CLIENT_CONTRACT_UPLOAD_v1
import { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  confirmRequirement,
  formatLimit,
  getRequirements,
  type MissingSchedule,
  type Requirement,
} from "@/api/contract";
import { getSelection } from "@/api/products";

const wrap: React.CSSProperties = { maxWidth: 620, margin: "0 auto", padding: 24 };
const card: React.CSSProperties = {
  border: "1px solid #cbd5e1", borderRadius: 12, padding: 16,
  marginBottom: 12, background: "#fff",
};
// BI_CLIENT_REFERRAL_v8
const notice: React.CSSProperties = {
  background: "#fffbeb", border: "1px solid #fde68a", borderRadius: 8,
  padding: "10px 12px", margin: "10px 0", fontSize: 13, color: "#78350f",
};
const quote: React.CSSProperties = {
  borderLeft: "3px solid #cbd5e1", paddingLeft: 12, margin: "10px 0",
  color: "#475569", fontSize: 13, fontStyle: "italic",
};
const yes: React.CSSProperties = {
  padding: "8px 16px", borderRadius: 8, border: "none",
  background: "#1E3A8A", color: "#fff", cursor: "pointer", fontSize: 14, fontWeight: 600,
};
const no: React.CSSProperties = {
  padding: "8px 16px", borderRadius: 8, border: "1px solid #cbd5e1",
  background: "#fff", color: "#334155", cursor: "pointer", fontSize: 14,
};

export default function RequirementsPage() {
  const { applicationId = "" } = useParams();
  const navigate = useNavigate();
  const [items, setItems] = useState<Requirement[]>([]);
  // BI_CLIENT_MISSING_SCHEDULE_v10
  const [missing, setMissing] = useState<MissingSchedule[]>([]);
  // Named in the notice so "we cannot place this in Canada" reads as a fact
  // about the market rather than a fault of the applicant.
  const [country, setCountry] = useState("your country");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const r = await getRequirements(applicationId);
      setItems(r.requirements ?? []);
      setMissing(r.missingSchedules ?? []); // BI_CLIENT_MISSING_SCHEDULE_v10
      // BI_CLIENT_REFERRAL_v8
      try {
        const sel = await getSelection(applicationId);
        setCountry(sel.country === "US" ? "the United States" : "Canada");
      } catch {
        // The notice falls back to "your country".
      }
    } catch {
      setError("We could not load what we read from your contract. Please refresh.");
    } finally {
      setLoading(false);
    }
  }, [applicationId]);

  useEffect(() => { void load(); }, [load]);

  async function answer(req: Requirement, confirmed: boolean) {
    setSaving(req.id);
    try {
      await confirmRequirement(applicationId, req.id, confirmed);
      setItems((prev) =>
        prev.map((x) => (x.id === req.id ? { ...x, confirmedByClient: confirmed } : x)),
      );
    } catch {
      setError("That did not save. Please try again.");
    } finally {
      setSaving(null);
    }
  }

  if (loading) return <div style={wrap}>Reading your contract…</div>;

  const outstanding = items.filter((x) => x.confirmedByClient === null).length;

  return (
    <div style={wrap}>
      <h1 style={{ fontSize: 22, marginBottom: 4 }}>What your contract asks for</h1>
      <p style={{ color: "#475569", fontSize: 14, marginTop: 0 }}>
        This is what we read in your subcontract. Please check each one against your
        own copy and tell us whether we read it correctly. We have quoted the exact
        wording so you can compare.
      </p>
      {error && <div style={{ color: "#b91c1c", fontSize: 13, marginBottom: 12 }}>{error}</div>}
      {items.length === 0 ? (
        <div style={card}>
          {/* BI_CLIENT_MISSING_SCHEDULE_v10 - when the contract names the
              schedule it relies on, say which one rather than speculating. */}
          <div style={{ fontWeight: 600, marginBottom: 6 }}>
            {missing.length > 0
              ? `Your contract puts the insurance in ${missing[0].ref}`
              : "We did not find any insurance clauses"}
          </div>
          <div style={{ fontSize: 14, color: "#475569" }}>
            {missing.length > 0
              ? `The agreement points to ${missing[0].ref}: ${missing[0].title}, which is a separate file. Upload it and we will read the coverages and limits from it.`
              : "That can happen when the requirements are in a separate schedule or an exhibit. If you have that document, upload it too. Otherwise we can go through it with you."}
          </div>
          {missing.length > 0 && (
            <button type="button" data-testid="upload-missing-schedule"
              style={{ ...yes, minHeight: 56, padding: "0 24px", fontSize: 16, marginTop: 12 }}
              onClick={() => navigate(`/schedule/${encodeURIComponent(applicationId)}`, { state: { missingSchedules: missing } })}>
              Upload {missing[0].ref}
            </button>
          )}
        </div>
      ) : (
        items.map((req) => (
          <div key={req.id} style={card} data-testid={`requirement-${req.coverageCode}`}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
              <strong style={{ fontSize: 16 }}>{req.displayName}</strong>
              <span style={{ fontSize: 14, color: "#1E3A8A", fontWeight: 600 }}>
                {formatLimit(req.extractedLimit)}
                {req.limitBasis ? ` ${req.limitBasis}` : ""}
              </span>
            </div>
            <div style={quote}>&ldquo;{req.clauseText}&rdquo;</div>
            {/* BI_CLIENT_REFERRAL_v8 - say plainly what happens when a
                requested coverage cannot be placed in this country. */}
            {req.available === false && (
              <div style={notice}>
                We cannot place this one in {country} ourselves. Confirm it and we will
                refer it to a market that can write it.
              </div>
            )}
            {req.confirmedByClient === null ? (
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <button
                  type="button"
                  style={yes}
                  disabled={saving === req.id}
                  data-testid={`confirm-${req.coverageCode}`}
                  onClick={() => void answer(req, true)}
                >
                  {saving === req.id ? "Saving…" : "Yes, that is right"}
                </button>
                <button
                  type="button"
                  style={no}
                  disabled={saving === req.id}
                  onClick={() => void answer(req, false)}
                >
                  No, that is not in my contract
                </button>
              </div>
            ) : (
              <div style={{ fontSize: 13, color: req.confirmedByClient ? "#15803d" : "#b91c1c" }}>
                {req.confirmedByClient
                  ? req.available === false
                    ? "Confirmed. We will refer this one out and come back to you."
                    : "Confirmed"
                  : "Marked as not required. We will leave it off."}
              </div>
            )}
          </div>
        ))
      )}
      {items.length > 0 && (
        <div style={{ fontSize: 13, color: "#64748b", marginTop: 16 }}>
          {outstanding > 0
            ? `${outstanding} still to check.`
            : "All checked. We will show you what is available next."}
        </div>
      )}
      {/* BI_CLIENT_REVIEW_v7 - this page had no way forward. An applicant whose
          contract held no insurance clauses read "we did not find any" and had
          nowhere to go. */}
      <div style={{ marginTop: 24, display: "flex", gap: 12, flexWrap: "wrap" }}>
        <button type="button" style={{ ...yes, minHeight: 56, padding: "0 24px", fontSize: 16 }}
          onClick={() => navigate(`/coverage/${encodeURIComponent(applicationId)}`)}>
          {items.length > 0 ? "Choose your coverage" : "Choose coverage yourself"}
        </button>
        <button type="button" style={{ ...no, minHeight: 56, padding: "0 24px", fontSize: 16 }}
          onClick={() => navigate(`/review/${encodeURIComponent(applicationId)}`)}>
          Review my application
        </button>
      </div>
    </div>
  );
}
