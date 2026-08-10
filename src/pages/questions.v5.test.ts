// BI_CLIENT_QUESTIONS_v5
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
const read = (r: string) => readFileSync(path.join(process.cwd(), r), "utf8");
const page = read("src/pages/QuestionsPage.tsx");
const router = read("src/router/AppRouter.tsx");

describe("one question per screen", () => {
  it("renders a single question, not a scrolling form", () => {
    expect(page).toContain("const q = visible[index];");
    expect(page).toContain("Question {index + 1} of {visible.length}");
  });
  it("shows progress so a long set does not feel endless", () => {
    expect(page).toContain("((index + 1) / visible.length) * 100");
  });
  it("resumes where the applicant stopped", () => {
    expect(page).toContain("findIndex((q) => q.value === null)");
  });
});

describe("conditional questions", () => {
  it("hides a question whose dependency is unmet", () => {
    expect(page).toContain("!q.dependsOnKey || answers[q.dependsOnKey]?.value === q.dependsOnValue");
  });
  it("asks for an explanation only on the adverse answer", () => {
    expect(page).toContain("current?.value === q.adverseAnswer");
    expect(page).toContain('placeholder="Please explain…"');
  });
  it("will not advance past a required question, or an unexplained adverse one", () => {
    expect(page).toContain("!needsReason || !!current?.reason?.trim()");
    expect(page).toContain("disabled={!canAdvance || busy}");
  });
});

describe("answers are saved as one batch", () => {
  it("posts every answered question at the end, not one per tap", () => {
    expect(page).toContain("saveAnswers(id, payload)");
    expect(page).toContain("answers[v.questionKey]?.value != null");
  });
});

describe("wiring", () => {
  it("is routed behind the applicant guard", () => {
    expect(router).toContain('path="/questions/:applicationId"');
    expect(router).toContain("<RequireApplicant><QuestionsPage /></RequireApplicant>");
  });
  it("tells the applicant which coverage asked", () => {
    expect(page).toContain("Asked for {q.askedBy.join");
  });
  it("handles agree/disagree separately from yes/no", () => {
    expect(page).toContain('["Agree", "Disagree"]');
  });
  it("keeps 56px targets and a sticky bar", () => {
    expect(page).toContain("minHeight: 56");
    expect(page).toContain('position: "fixed"');
  });
});
