// BI_CLIENT_QUESTIONS_v5 - step 3. One question per screen: the union across
// every selected coverage can run to fifty-odd questions, and a single long
// scrolling form on a phone is how applications get abandoned halfway.
import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { getQuestions, saveAnswers, type AnswerInput, type Question } from "@/api/questions";

const wrap: React.CSSProperties = { maxWidth: 620, margin: "0 auto", padding: 24, paddingBottom: 120 };
const bar: React.CSSProperties = {
  position: "fixed", left: 0, right: 0, bottom: 0, padding: 16,
  background: "#fff", borderTop: "1px solid #e2e8f0", display: "flex", gap: 12,
};
const cta: React.CSSProperties = {
  flex: 1, minHeight: 56, fontSize: 16, fontWeight: 600, borderRadius: 10,
  border: "none", background: "#1E3A8A", color: "#fff", cursor: "pointer",
};
const back: React.CSSProperties = {
  minHeight: 56, padding: "0 20px", fontSize: 16, borderRadius: 10,
  border: "1px solid #cbd5e1", background: "#fff", color: "#334155", cursor: "pointer",
};
const choice = (on: boolean): React.CSSProperties => ({
  width: "100%", minHeight: 56, fontSize: 16, fontWeight: 600, borderRadius: 10,
  marginBottom: 12, cursor: "pointer",
  border: on ? "2px solid #1E3A8A" : "1px solid #cbd5e1",
  background: on ? "#eef2ff" : "#fff", color: "#0f172a",
});
const area: React.CSSProperties = {
  width: "100%", minHeight: 110, fontSize: 16, padding: 12, borderRadius: 10,
  border: "1px solid #cbd5e1", boxSizing: "border-box", marginTop: 12,
};

function optionsFor(q: Question): string[] {
  if (q.inputType === "agree_disagree") return ["Agree", "Disagree"];
  return ["yes", "no"];
}
const optionLabel = (v: string) => (v === "yes" ? "Yes" : v === "no" ? "No" : v);

export default function QuestionsPage() {
  const { applicationId = "" } = useParams();
  const navigate = useNavigate();
  const [all, setAll] = useState<Question[]>([]);
  const [answers, setAnswers] = useState<Record<string, { value: string | null; reason: string | null }>>({});
  const [resolvedId, setResolvedId] = useState("");
  const [index, setIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const set = await getQuestions(applicationId);
      setResolvedId(set.applicationId || applicationId);
      setAll(set.questions ?? []);
      const seeded: Record<string, { value: string | null; reason: string | null }> = {};
      for (const q of set.questions ?? []) {
        if (q.value !== null) seeded[q.questionKey] = { value: q.value, reason: q.reason };
      }
      setAnswers(seeded);
      // Resume where they stopped rather than at question one.
      const firstUnanswered = (set.questions ?? []).findIndex((q) => q.value === null);
      setIndex(firstUnanswered === -1 ? 0 : firstUnanswered);
    } catch {
      setError("We could not load your questions. Please refresh.");
    } finally {
      setLoading(false);
    }
  }, [applicationId]);

  useEffect(() => { void load(); }, [load]);

  // A question whose dependency is unmet is not asked at all, so it can never
  // block completion.
  const visible = useMemo(
    () => all.filter((q) => !q.dependsOnKey || answers[q.dependsOnKey]?.value === q.dependsOnValue),
    [all, answers],
  );

  const q = visible[index];
  const current = q ? answers[q.questionKey] : undefined;
  const needsReason = !!q && !!q.adverseAnswer && current?.value === q.adverseAnswer;
  const canAdvance = !!q && (!q.required || (!!current?.value && (!needsReason || !!current?.reason?.trim())));

  function answer(value: string) {
    if (!q) return;
    setAnswers((prev) => ({ ...prev, [q.questionKey]: { value, reason: prev[q.questionKey]?.reason ?? null } }));
  }
  function setReason(reason: string) {
    if (!q) return;
    setAnswers((prev) => ({ ...prev, [q.questionKey]: { value: prev[q.questionKey]?.value ?? null, reason } }));
  }

  async function next() {
    if (!canAdvance || busy) return;
    if (index < visible.length - 1) { setIndex(index + 1); return; }
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
      navigate(`/requirements/${encodeURIComponent(id)}`);
    } catch {
      setError("We could not save your answers. Please try again.");
      setBusy(false);
    }
  }

  if (loading) return <div style={wrap}>Loading…</div>;
  if (!q) {
    return (
      <div style={wrap}>
        <h1 style={{ fontSize: 22 }}>Nothing to answer yet</h1>
        <p style={{ color: "#475569", fontSize: 14 }}>
          Choose your coverage first and we will ask only what those policies require.
        </p>
      </div>
    );
  }

  return (
    <div style={wrap}>
      <div style={{ fontSize: 12, color: "#64748b", marginBottom: 8 }}>
        Question {index + 1} of {visible.length}
      </div>
      <div style={{ height: 4, background: "#e2e8f0", borderRadius: 999, marginBottom: 24 }}>
        <div style={{ height: 4, borderRadius: 999, background: "#1E3A8A",
          width: `${Math.round(((index + 1) / visible.length) * 100)}%` }} />
      </div>

      <h1 style={{ fontSize: 19, lineHeight: 1.4, marginTop: 0, marginBottom: 8 }}>{q.prompt}</h1>
      {q.helpText && <p style={{ color: "#475569", fontSize: 14, marginTop: 0 }}>{q.helpText}</p>}
      {q.askedBy.length > 0 && (
        <p style={{ color: "#64748b", fontSize: 12, marginTop: 0, marginBottom: 20 }}>
          Asked for {q.askedBy.join(", ")}
        </p>
      )}

      {optionsFor(q).map((opt) => (
        <button key={opt} type="button" style={choice(current?.value === opt)}
          aria-pressed={current?.value === opt} onClick={() => answer(opt)}>
          {optionLabel(opt)}
        </button>
      ))}

      {needsReason && (
        <textarea style={area} rows={3} placeholder="Please explain…"
          value={current?.reason ?? ""} onChange={(e) => setReason(e.target.value)} />
      )}

      {error && <div style={{ color: "#b91c1c", fontSize: 14, marginTop: 12 }}>{error}</div>}

      <div style={bar}>
        {index > 0 && (
          <button type="button" style={back} onClick={() => setIndex(index - 1)}>Back</button>
        )}
        <button type="button" style={{ ...cta, opacity: canAdvance && !busy ? 1 : 0.5 }}
          disabled={!canAdvance || busy} onClick={() => void next()}>
          {busy ? "Saving..." : index < visible.length - 1 ? "Next" : "Finish"}
        </button>
      </div>
    </div>
  );
}
