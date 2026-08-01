import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const read = (...p: string[]) => readFileSync(join(process.cwd(), "src", ...p), "utf-8");
const requirements = read("pages", "RequirementsPage.tsx");
const upload = read("pages", "UploadContractPage.tsx");
const router = read("router", "AppRouter.tsx");
const env = read("env.ts");

describe("BI_CLIENT_CONTRACT_UPLOAD_v1", () => {
  it("points at the bi-server host that actually resolves", () => {
    expect(env).toContain("bi-server-cse0apamgkheb9d5.canadacentral-01.azurewebsites.net");
    expect(env).not.toContain('"https://bi-server.azurewebsites.net"');
  });

  it("quotes the clause it read, so the applicant can check it", () => {
    expect(requirements).toContain("req.clauseText");
  });

  it("asks the applicant to confirm rather than asserting", () => {
    expect(requirements).toContain("Yes, that is right");
    expect(requirements).toContain("No, that is not in my contract");
    expect(requirements).toContain("confirmRequirement");
  });

  it("explains an empty result instead of showing a blank screen", () => {
    expect(requirements).toContain("We did not find any insurance clauses");
  });

  it("tells the applicant which upload failures they can act on", () => {
    expect(upload).toContain("no_text_found");
    expect(upload).toContain("unsupported_file_type");
    expect(upload).toContain("file_too_large");
  });

  it("keeps both new screens behind the applicant guard", () => {
    expect(router).toContain("<RequireApplicant><UploadContractPage /></RequireApplicant>");
    expect(router).toContain("<RequireApplicant><RequirementsPage /></RequireApplicant>");
  });
});
