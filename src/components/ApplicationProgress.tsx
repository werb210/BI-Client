// BI_CLIENT_APPLICATION_PROGRESS_v280
// Where the applicant's application stands, from BI-Server v279
// (/applicants/me/progress). The server decides every step's state; this only
// draws it. Refreshes when the app comes back to the foreground. Renders
// nothing when there is no application or the server is older than v279.
import { useCallback, useEffect, useState } from "react";
import { api } from "@/api/client";

export type ProgressStep = { key: string; label: string; state: "done" | "current" | "upcoming" | "attention" | "stopped" };
export type ApplicantProgress = { publicId: string | null; headline: string; detail: string; steps: ProgressStep[]; updatedAt: string | null };

const COLORS: Record<ProgressStep["state"], { dot: string; text: string }> = {
  done: { dot: "#16a34a", text: "#0B1F3A" },
  current: { dot: "#BF9B49", text: "#0B1F3A" },
  attention: { dot: "#d97706", text: "#92400e" },
  stopped: { dot: "#B00020", text: "#B00020" },
  upcoming: { dot: "#cbd5e1", text: "#64748b" },
};

export function stepMarker(state: ProgressStep["state"]): string {
  return state === "done" ? "✓" : state === "attention" ? "!" : state === "stopped" ? "×" : "";
}

export default function ApplicationProgress() {
  const [progress, setProgress] = useState<ApplicantProgress | null>(null);

  const load = useCallback(async () => {
    try {
      const r = await api.get<{ progress: ApplicantProgress | null }>("/applicants/me/progress");
      setProgress(r?.progress && Array.isArray(r.progress.steps) ? r.progress : null);
    } catch {
      // Keep whatever was showing; never blank the home screen over this.
    }
  }, []);

  useEffect(() => {
    void load();
    const onResume = () => { void load(); };
    window.addEventListener("boreal:native-resume", onResume);
    return () => window.removeEventListener("boreal:native-resume", onResume);
  }, [load]);

  if (!progress) return null;

  return (
    <section className="bi-card" data-testid="application-progress" aria-label="Application progress" style={{ marginBottom: 16 }}>
      <h2 style={{ margin: "0 0 4px", fontSize: 18 }}>{progress.headline}</h2>
      <p style={{ margin: "0 0 14px", fontSize: 14, color: "#475569" }}>{progress.detail}</p>
      <ol style={{ listStyle: "none", margin: 0, padding: 0 }}>
        {progress.steps.map((step, i) => (
          <li key={step.key} data-state={step.state} style={{ display: "flex", alignItems: "center", gap: 10, padding: "6px 0" }}>
            <span aria-hidden="true" style={{
              width: 22, height: 22, borderRadius: 11, flexShrink: 0, display: "inline-flex", alignItems: "center", justifyContent: "center",
              fontSize: 13, fontWeight: 700, color: "#fff", background: COLORS[step.state].dot,
              boxShadow: step.state === "current" ? "0 0 0 4px rgba(191,155,73,0.25)" : "none",
            }}>{stepMarker(step.state) || (step.state === "upcoming" ? "" : String(i + 1))}</span>
            <span style={{ fontSize: 15, fontWeight: step.state === "current" || step.state === "attention" ? 700 : 500, color: COLORS[step.state].text }}>
              {step.label}
              <span className="sr-only"> ({step.state})</span>
            </span>
          </li>
        ))}
      </ol>
    </section>
  );
}
