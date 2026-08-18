import BackBar from "@/components/BackBar"; // BI_CLIENT_FLOW_v12
// BI_CLIENT_QUESTION_GROUPS_v6 - step 3, one screen per group rather than one
// per question. v5 paged every question separately and PGI alone produced
// sixteen taps of Yes/No/Next, which reads as an interrogation. The bank
// already carries group_key, so the declarations answer as one block and the
// consents as another.
import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { getQuestions, saveAnswers, type AnswerInput, type Question } from "@/api/questions";

// BI_CLIENT_SHELL_v21 - width, ground and padding come from chrome.css. The
// 120px bottom padding stays because the CTA bar below is position:fixed and
// would otherwise sit over the last control.
const wrap: React.CSSProperties = { paddingBottom: 120 };
const bar: React.CSSProperties = {
  position: "fixed", left: 0, right: 0, bottom: 0, padding: 16,
  background: "#fff", borderTop: "1px solid #E4EAF2", display: "flex", gap: 12,
};
// BI_CLIENT_CTA_v23 - the primary button is .bi-cta in chrome.css now.
const back: React.CSSProperties = {
  minHeight: 56, padding: "0 20px", fontSize: 16, borderRadius: 8,
  border: "1px solid #E4EAF2", background: "#fff", color: "#0B1F3A", cursor: "pointer",
};
const block: React.CSSProperties = {
  padding: "18px 0", borderBottom: "1px solid #E4EAF2",
};
const row: React.CSSProperties = { display: "flex", gap: 10, marginTop: 12 };
// Side-by-side keeps a long list scannable; still 56px tall for thumbs.
const pill = (on: boolean): React.CSSProperties => ({
  flex: 1, minHeight: 56, fontSize: 16, fontWeight: 600, borderRadius: 8, cursor: "pointer",
  border: on ? "2px solid #0B1F3A" : "1px solid #E4EAF2",
  background: on ? "#eef2ff" : "#fff", color: "#0B1F3A",
});
// BI_CLIENT_FIELD_INPUTS_v9 - text, date, number and select. Everything is
// 56px tall and 16px type, because iOS zooms the page on any input under 16px.
// BI_CLIENT_CTA_v23 - identical to .bi-field apart from the top margin.
const field: React.CSSProperties = { marginTop: 12 };
const area: React.CSSProperties = {
  width: "100%", minHeight: 92, fontSize: 16, padding: 12, borderRadius: 8,
  border: "1px solid #E4EAF2", boxSizing: "border-box", marginTop: 12,
};

const GROUP_TITLES: Record<string, string> = {
  // BI_CLIENT_FIELD_INPUTS_v9
  guarantor: "About you",
  business: "About the business",
  loan: "About the loan",
  declarations: "A few disclosures",
  consents: "Consents",
  general: "A few more questions",
};
const GROUP_BLURBS: Record<string, string> = {
  guarantor: "The carrier needs this to confirm who you are.",
  business: "The company the guarantee is being given for.",
  loan: "The borrowing the personal guarantee sits behind.",
  declarations: "Answer honestly. A yes does not disqualify you; it just needs a short explanation.",
  consents: "The last step before we can place your coverage.",
};

const CHOICE_TYPES = new Set(["yes_no", "agree_disagree"]);

function optionsFor(q: Question): string[] {
  if (q.inputType === "agree_disagree") return ["Agree", "Disagree"];
  return ["yes", "no"];
}

// Cross-field rules the BI-Website form enforced. The carrier will not write
// cover above 80% of the loan, so catching it here saves a rejection later.
function fieldError(q: Question, raw: string | null, all: Record<string, { value: string | null }>): string | null {
  if (!raw || !raw.trim()) return null;
  if (q.inputType === "number") {
    const n = Number(raw);
    if (!Number.isFinite(n)) return "Please enter a number.";
    if (q.minValue !== null && n < q.minValue) return `Must be at least $${q.minValue.toLocaleString()}.`;
    if (q.maxValue !== null && n > q.maxValue) return `Cannot be more than $${q.maxValue.toLocaleString()}.`;
    if (q.questionKey === "pgi_limit") {
      const loan = Number(all["loan_amount"]?.value ?? 0);
      if (loan > 0 && n > loan * 0.8) {
        return `Cannot be more than 80% of the loan, so $${Math.floor(loan * 0.8).toLocaleString()} maximum.`;
      }
    }
  }
  return null;
}
const optionLabel = (v: string) => (v === "yes" ? "Yes" : v === "no" ? "No" : v);

type Answer = { value: string | null; reason: string | null };

export default function QuestionsPage() {
  const { applicationId = "" } = useParams();
  const navigate = useNavigate();
  const [all, setAll] = useState<Question[]>([]);
  const [answers, setAnswers] = useState<Record<string, Answer>>({});
  const [resolvedId, setResolvedId] = useState("");
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Only nag about missing answers after they have tried to move on.
  const [showGaps, setShowGaps] = useState(false);

  const load = useCallback(async () => {
    try {
      const set = await getQuestions(applicationId);
      setResolvedId(set.applicationId || applicationId);
      setAll(set.questions ?? []);
      const seeded: Record<string, Answer> = {};
      for (const q of set.questions ?? []) {
        if (q.value !== null) seeded[q.questionKey] = { value: q.value, reason: q.reason };
      }
      setAnswers(seeded);
    } catch {
      setError("We could not load your questions. Please refresh.");
    } finally {
      setLoading(false);
    }
  }, [applicationId]);

  useEffect(() => { void load(); }, [load]);

  const visible = useMemo(
    () => all.filter((q) => !q.dependsOnKey || answers[q.dependsOnKey]?.value === q.dependsOnValue),
    [all, answers],
  );

  // Groups keep the server's sort_order; the first question of a group decides
  // where that group sits, so ordering stays data.
  const groups = useMemo(() => {
    const seen: string[] = [];
    for (const q of visible) if (!seen.includes(q.group)) seen.push(q.group);
    return seen.map((key) => ({ key, questions: visible.filter((q) => q.group === key) }));
  }, [visible]);

  const group = groups[step];

  function isComplete(q: Question): boolean {
    const a = answers[q.questionKey];
    // BI_CLIENT_FIELD_INPUTS_v9 - an out-of-range number is not an answer.
    if (fieldError(q, a?.value ?? null, answers)) return false;
    if (!q.required) return true;
    if (!a?.value || !a.value.trim()) return false;
    if (q.adverseAnswer && a.value === q.adverseAnswer) return !!a.reason?.trim();
    return true;
  }
  const missing = group ? group.questions.filter((q) => !isComplete(q)) : [];

  function answer(q: Question, value: string) {
    setAnswers((prev) => ({ ...prev, [q.questionKey]: { value, reason: prev[q.questionKey]?.reason ?? null } }));
  }
  function setReason(q: Question, reason: string) {
    setAnswers((prev) => ({ ...prev, [q.questionKey]: { value: prev[q.questionKey]?.value ?? null, reason } }));
  }

  async function next() {
    if (busy) return;
    if (missing.length > 0) {
      setShowGaps(true);
      return;
    }
    setShowGaps(false);
    if (step < groups.length - 1) { setStep(step + 1); window.scrollTo(0, 0); return; }
    setBusy(true);
    setError(null);
    try {
      const payload: AnswerInput[] = visible
        .filter((v) => answers[v.questionKey]?.value != null)
        .map((v) => ({
          questionKey: v.questionKey,
          value: answers[v.questionKey].value,
          reason: answers[v.questionKey].reason,
        }));
      const id = resolvedId || applicationId;
      await saveAnswers(id, payload);
      // BI_CLIENT_REVIEW_v7 - step 3 leads to review, not to the contract
      // requirements page, which is meaningless without an uploaded contract.
      navigate(`/review/${encodeURIComponent(id)}`);
    } catch {
      setError("We could not save your answers. Please try again.");
      setBusy(false);
    }
  }

  if (loading) return <div className="bi-page" style={wrap}>Loading…</div>;
  if (!group) {
    return (
      <div className="bi-page" style={wrap}>
        <h1>Nothing to answer yet</h1>
        <p style={{ color: "#51617D", fontSize: 14 }}>
          Choose your coverage first and we will ask only what those policies require.
        </p>
      </div>
    );
  }

  return (
    <div className="bi-page" style={wrap}>
      <BackBar />
      <div style={{ fontSize: 12, color: "#8593aa", marginBottom: 8 }}>
        Step {step + 1} of {groups.length}
      </div>
      <div style={{ height: 4, background: "#E4EAF2", borderRadius: 8, marginBottom: 20 }}>
        <div style={{ height: 4, borderRadius: 8, background: "#0B1F3A",
          width: `${Math.round(((step + 1) / groups.length) * 100)}%` }} />
      </div>

      <h1 style={{ fontSize: 22, marginTop: 0, marginBottom: 4 }}>
        {GROUP_TITLES[group.key] ?? "A few more questions"}
      </h1>
      <p style={{ color: "#51617D", fontSize: 14, marginTop: 0, marginBottom: 8 }}>
        {GROUP_BLURBS[group.key] ?? ""}
      </p>

      {group.questions.map((q) => {
        const a = answers[q.questionKey];
        const needsReason = !!q.adverseAnswer && a?.value === q.adverseAnswer;
        const gap = showGaps && !isComplete(q);
        return (
          <div key={q.questionKey} style={block}>
            <div style={{ fontSize: 15, lineHeight: 1.45, fontWeight: 500 }}>{q.prompt}</div>
            {q.helpText && (
              <div style={{ color: "#51617D", fontSize: 13, marginTop: 4 }}>{q.helpText}</div>
            )}
            {CHOICE_TYPES.has(q.inputType) ? (
              <div style={row}>
                {optionsFor(q).map((opt) => (
                  <button key={opt} type="button" style={pill(a?.value === opt)}
                    aria-pressed={a?.value === opt} onClick={() => answer(q, opt)}>
                    {optionLabel(opt)}
                  </button>
                ))}
              </div>
            ) : q.inputType === "select" ? (
              <select className="bi-field" style={field} value={a?.value ?? ""} aria-label={q.prompt}
                onChange={(e) => answer(q, e.target.value)}>
                <option value="">Choose one…</option>
                {(q.options ?? []).map((opt) => <option key={opt} value={opt}>{opt}</option>)}
              </select>
            ) : q.inputType === "textarea" ? (
              <textarea style={{ ...area, marginTop: 12 }} rows={3} aria-label={q.prompt}
                placeholder={q.placeholder ?? ""} value={a?.value ?? ""}
                onChange={(e) => answer(q, e.target.value)} />
            ) : (
              <input className="bi-field" style={field} aria-label={q.prompt}
                type={q.inputType === "date" ? "date" : q.inputType === "number" ? "number" : "text"}
                inputMode={q.inputType === "number" ? "decimal" : undefined}
                min={q.minValue ?? undefined} max={q.maxValue ?? undefined}
                placeholder={q.placeholder ?? ""} value={a?.value ?? ""}
                onChange={(e) => answer(q, e.target.value)} />
            )}
            {fieldError(q, a?.value ?? null, answers) && (
              <div style={{ color: "#b91c1c", fontSize: 13, marginTop: 8 }}>
                {fieldError(q, a?.value ?? null, answers)}
              </div>
            )}
            {needsReason && (
              <textarea style={area} rows={2} placeholder="Please explain…"
                value={a?.reason ?? ""} onChange={(e) => setReason(q, e.target.value)} />
            )}
            {gap && (
              <div style={{ color: "#b91c1c", fontSize: 13, marginTop: 8 }}>
                {!a?.value
                  ? "Please answer this one."
                  : fieldError(q, a.value, answers)
                    ? "Please correct this one."
                    : "Please add a short explanation."}
              </div>
            )}
          </div>
        );
      })}

      {showGaps && missing.length > 0 && (
        <div style={{ color: "#b91c1c", fontSize: 14, marginTop: 16 }}>
          {missing.length} question{missing.length === 1 ? "" : "s"} still needs an answer.
        </div>
      )}
      {error && <div style={{ color: "#b91c1c", fontSize: 14, marginTop: 12 }}>{error}</div>}

      <div style={bar}>
        {step > 0 && (
          <button type="button" style={back}
            onClick={() => { setShowGaps(false); setStep(step - 1); window.scrollTo(0, 0); }}>
            Back
          </button>
        )}
        <button type="button" className="bi-cta bi-cta--inline" disabled={busy}
          onClick={() => void next()}>
          {busy ? "Saving..." : step < groups.length - 1 ? "Continue" : "Finish"}
        </button>
      </div>
    </div>
  );
}
