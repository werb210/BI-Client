// BI_CLIENT_COVERAGE_v4
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
const read = (r: string) => readFileSync(path.join(process.cwd(), r), "utf8");
const page = read("src/pages/CoveragePage.tsx");
const upload = read("src/pages/UploadContractPage.tsx");
const router = read("src/router/AppRouter.tsx");
const api = read("src/api/products.ts");

describe("the no-contract path has an entry point", () => {
  it("the upload page offers it instead of dead-ending", () => {
    expect(upload).toContain("I do not have a subcontract yet");
    expect(upload).toContain('navigate("/coverage/me")');
  });
  it("the route exists behind the applicant guard", () => {
    expect(router).toContain('path="/coverage/:applicationId"');
    expect(router).toContain("<RequireApplicant><CoveragePage /></RequireApplicant>");
  });
});

describe("the list comes from the server, not the client", () => {
  it("does not hardcode a country", () => {
    expect(page).not.toContain('const country = "CA"');
    expect(page).toContain('sel.country === "US" ? "US" : "CA"');
  });
  it("orders by whatever sort_order the server returns, so PGI leads", () => {
    expect(page).not.toContain(".sort(");
    expect(api).toContain("sort_order: number");
  });
  it("resolves the literal me to a real application id before saving", () => {
    expect(page).toContain("setResolvedId(sel.applicationId || applicationId)");
    expect(page).toContain("const id = resolvedId || applicationId;");
  });
});

describe("contract-required lines cannot be unticked", () => {
  it("toggle refuses them and the checkbox is disabled", () => {
    expect(page).toContain("if (required.has(code)) return;");
    expect(page).toContain("disabled={isRequired}");
    expect(page).toContain("Required by your contract");
  });
  it("they still count toward the continue total", () => {
    expect(page).toContain("const total = chosen.size + required.size;");
  });
});

describe("mobile-first, per locked ruling 23", () => {
  it("uses a sticky CTA and 44px+ targets", () => {
    expect(page).toContain('position: "fixed"');
    expect(page).toContain("minHeight: 56");
  });
  it("rows are keyboard and screen-reader operable, not just clickable divs", () => {
    expect(page).toContain('role="checkbox"');
    expect(page).toContain("aria-checked={isOn}");
    expect(page).toContain("onKeyDown");
  });
  it("cannot continue with nothing selected", () => {
    expect(page).toContain("disabled={total === 0 || busy}");
  });
});
