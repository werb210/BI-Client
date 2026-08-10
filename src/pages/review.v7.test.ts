// BI_CLIENT_REVIEW_v7
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
const read = (r: string) => readFileSync(path.join(process.cwd(), r), "utf8");
const page = read("src/pages/ReviewPage.tsx");
const questions = read("src/pages/QuestionsPage.tsx");
const requirements = read("src/pages/RequirementsPage.tsx");
const router = read("src/router/AppRouter.tsx");

describe("the flow no longer dead-ends", () => {
  it("step 3 leads to review, not the contract requirements page", () => {
    expect(questions).toContain("navigate(`/review/${encodeURIComponent(id)}`)");
    expect(questions).not.toContain("navigate(`/requirements/${encodeURIComponent(id)}`)");
  });
  it("the requirements page offers a way forward even with no clauses found", () => {
    expect(requirements).toContain("Choose coverage yourself");
    expect(requirements).toContain("Review my application");
    expect(requirements).toContain("navigate(`/review/${encodeURIComponent(applicationId)}`)");
  });
  it("review is routed behind the applicant guard", () => {
    expect(router).toContain('path="/review/:applicationId"');
    expect(router).toContain("<RequireApplicant><ReviewPage /></RequireApplicant>");
  });
});

describe("review shows what was captured and how to change it", () => {
  it("lists details, coverage, documents and question progress", () => {
    for (const heading of ["Your details", "Coverage requested", "Documents", "Questions"]) {
      expect(page).toContain(heading);
    }
  });
  it("marks which coverages the contract forced", () => {
    expect(page).toContain('c.source === "contract"');
  });
  it("offers a route back to each step rather than a dead end", () => {
    expect(page).toContain('navigate(`/coverage/${encodeURIComponent(s.applicationId)}`)');
    expect(page).toContain('navigate("/upload")');
    expect(page).toContain('navigate(`/questions/${encodeURIComponent(s.applicationId)}`)');
  });
  it("says plainly that no documents is acceptable", () => {
    expect(page).toContain("None uploaded. That is fine");
  });
});

describe("submission", () => {
  it("is gated on the server's own canSubmit, not a local count", () => {
    expect(page).toContain("disabled={!s.canSubmit || busy}");
    expect(page).toContain("s.canSubmit ? \"Submit my application\"");
  });
  it("re-reads the summary when the server refuses", () => {
    expect(page).toContain("void load();");
  });
  it("shows a confirmation with the reference once submitted", () => {
    expect(page).toContain("That's everything we need");
    expect(page).toContain('data.status === "ready_for_submission"');
  });
  it("names the outstanding questions rather than just counting them", () => {
    expect(page).toContain("s.outstanding.slice(0, 5).map");
  });
});
