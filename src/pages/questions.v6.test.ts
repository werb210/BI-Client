// BI_CLIENT_QUESTION_GROUPS_v6 - replaces the v5 one-question-per-screen
// assertions. Those tested the old intent; the intent changed, so they are
// rewritten rather than reverted.
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
const read = (r: string) => readFileSync(path.join(process.cwd(), r), "utf8");
const page = read("src/pages/QuestionsPage.tsx");
const router = read("src/router/AppRouter.tsx");

describe("one screen per group, not per question", () => {
  it("pages by group rather than by question index", () => {
    expect(page).toContain("const group = groups[step];");
    expect(page).toContain("Step {step + 1} of {groups.length}");
    expect(page).not.toContain("Question {index + 1} of");
  });
  it("renders every question in the group at once", () => {
    expect(page).toContain("group.questions.map((q) =>");
  });
  it("groups in the server's order, so ordering stays data", () => {
    expect(page).toContain("for (const q of visible) if (!seen.includes(q.group)) seen.push(q.group);");
    expect(page).not.toContain(".sort(");
  });
  it("titles the disclosure block plainly", () => {
    expect(page).toContain('declarations: "A few disclosures"');
    expect(page).toContain('consents: "Consents"');
  });
});

describe("completion is checked per group", () => {
  it("blocks Continue until every required question in the group is answered", () => {
    expect(page).toContain("const missing = group ? group.questions.filter((q) => !isComplete(q)) : [];");
    expect(page).toContain("if (missing.length > 0)");
  });
  it("requires an explanation only on the adverse answer", () => {
    expect(page).toContain("if (q.adverseAnswer && a.value === q.adverseAnswer) return !!a.reason?.trim();");
  });
  it("only flags gaps after the applicant tries to move on", () => {
    expect(page).toContain("const gap = showGaps && !isComplete(q);");
  });
});

describe("conditional questions still apply", () => {
  it("hides a question whose dependency is unmet", () => {
    expect(page).toContain("!q.dependsOnKey || answers[q.dependsOnKey]?.value === q.dependsOnValue");
  });
});

describe("answers are saved as one batch at the end", () => {
  it("posts every answered question, not one per tap", () => {
    expect(page).toContain("saveAnswers(id, payload)");
    expect(page).toContain("answers[v.questionKey]?.value != null");
  });
});

describe("wiring and touch targets", () => {
  it("is routed behind the applicant guard", () => {
    expect(router).toContain('path="/questions/:applicationId"');
    expect(router).toContain("<RequireApplicant><QuestionsPage /></RequireApplicant>");
  });
  it("handles agree/disagree separately from yes/no", () => {
    expect(page).toContain('["Agree", "Disagree"]');
  });
  it("keeps 56px targets and a sticky bar", () => {
    expect(page).toContain("minHeight: 56");
    expect(page).toContain('position: "fixed"');
  });
  it("scrolls to the top when the group changes", () => {
    expect((page.match(/window\.scrollTo\(0, 0\)/g) || []).length).toBe(2);
  });
});
