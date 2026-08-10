// BI_CLIENT_FIELD_INPUTS_v9
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
const read = (r: string) => readFileSync(path.join(process.cwd(), r), "utf8");
const page = read("src/pages/QuestionsPage.tsx");
const api = read("src/api/questions.ts");

describe("step 3 renders every input type the bank can hold", () => {
  it("still uses pills for yes/no and agree/disagree", () => {
    expect(page).toContain('const CHOICE_TYPES = new Set(["yes_no", "agree_disagree"]);');
    expect(page).toContain("CHOICE_TYPES.has(q.inputType)");
  });
  it("renders a select from the options array", () => {
    expect(page).toContain('q.inputType === "select"');
    expect(page).toContain("(q.options ?? []).map((opt) =>");
    expect(page).toContain("Choose one…");
  });
  it("renders date and number with the right keyboard", () => {
    expect(page).toContain('q.inputType === "date" ? "date" : q.inputType === "number" ? "number" : "text"');
    expect(page).toContain('inputMode={q.inputType === "number" ? "decimal" : undefined}');
  });
  it("keeps inputs at 16px so iOS does not zoom the page", () => {
    const f = page.slice(page.indexOf("const field: React.CSSProperties"));
    expect(f).toContain("fontSize: 16");
    expect(f).toContain("minHeight: 56");
  });
});

describe("the numeric rules from the BI-Website form are enforced", () => {
  it("honours the min and max the bank supplies", () => {
    expect(page).toContain("if (q.minValue !== null && n < q.minValue)");
    expect(page).toContain("if (q.maxValue !== null && n > q.maxValue)");
  });
  it("keeps cover at or below 80% of the loan", () => {
    expect(page).toContain('q.questionKey === "pgi_limit"');
    expect(page).toContain("n > loan * 0.8");
  });
  it("treats an out-of-range value as incomplete, not as an answer", () => {
    expect(page).toContain("if (fieldError(q, a?.value ?? null, answers)) return false;");
  });
  it("tells the applicant to correct rather than to answer", () => {
    expect(page).toContain('"Please correct this one."');
  });
  it("does not accept whitespace as a required answer", () => {
    expect(page).toContain("if (!a?.value || !a.value.trim()) return false;");
  });
});

describe("the new groups are named for a subcontractor, not a carrier", () => {
  it("titles them plainly", () => {
    expect(page).toContain('guarantor: "About you"');
    expect(page).toContain('business: "About the business"');
    expect(page).toContain('loan: "About the loan"');
  });
});

describe("the type carries the new metadata", () => {
  it("includes select and the input metadata", () => {
    expect(api).toContain('| "select";');
    expect(api).toContain("options: string[] | null;");
    expect(api).toContain("minValue: number | null;");
  });
});
