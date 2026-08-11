// BI_CLIENT_MISSING_SCHEDULE_v10
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

const read = (relativePath: string) => readFileSync(path.join(process.cwd(), relativePath), "utf8");
const page = read("src/pages/MissingSchedulePage.tsx");
const upload = read("src/pages/UploadContractPage.tsx");
const requirements = read("src/pages/RequirementsPage.tsx");
const router = read("src/router/AppRouter.tsx");
const contractApi = read("src/api/contract.ts");

describe("a contract that defers its coverages asks for the schedule", () => {
  it("sends the applicant to the ask rather than to an empty list", () => {
    expect(upload).toContain('result.documentKind === "agreement_only"');
    expect(upload).toContain("navigate(`/schedule/${encodeURIComponent(result.applicationId)}`");
  });

  it("carries the named schedule through so the page can be specific", () => {
    expect(upload).toContain("state: { missingSchedules: result.missingSchedules }");
    expect(page).toContain("const label = named ? `${named.ref}: ${named.title}`");
  });

  it("falls back to plain wording when the contract named nothing", () => {
    expect(page).toContain('"the insurance schedule"');
  });

  it("is reachable and guarded like every other applicant page", () => {
    expect(router).toContain('path="/schedule/:applicationId"');
    expect(router).toContain("<RequireApplicant><MissingSchedulePage /></RequireApplicant>");
  });
});

describe("the applicant is never trapped on it", () => {
  it("offers a way past when they do not have the document", () => {
    expect(page).toContain('data-testid="skip-schedule"');
    expect(page).toContain("I do not have that document");
  });

  it("the skip continues the flow rather than dead-ending", () => {
    expect(page).toContain("const onwards = () => navigate(`/requirements/${encodeURIComponent(applicationId)}`)");
  });

  it("a successful upload moves on by itself", () => {
    expect(page).toContain("await uploadContract(file);\n      onwards();");
  });
});

describe("it is built for a phone", () => {
  it("uses 56px touch targets and 16px type so iOS does not zoom", () => {
    expect(page).toContain("minHeight: 56");
    expect(page).not.toMatch(/fontSize: 1[0-5],/);
  });
});

describe("the reload path tells the same story", () => {
  it("reads the missing schedule back from the server", () => {
    expect(contractApi).toContain("missingSchedules?: MissingSchedule[]");
    expect(requirements).toContain("setMissing(r.missingSchedules ?? []);");
  });

  it("names the schedule instead of implying the contract has no insurance", () => {
    expect(requirements).toContain("Your contract puts the insurance in ${missing[0].ref}");
    expect(requirements).toContain('data-testid="upload-missing-schedule"');
  });
});
