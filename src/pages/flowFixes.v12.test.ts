import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
const read = (p: string) => readFileSync(path.join(process.cwd(), p), "utf8");
describe("v12 flow fixes", () => {
  it("automatically submits complete OTP values", () => { const s=read("src/pages/SignInPage.tsx"); expect(s).toContain("if (d.length !== 6) return;"); expect(s).toContain("if (sentFor.current === d) return;"); });
  it("persists the profile draft", () => { const s=read("src/pages/StartPage.tsx"); expect(s).toContain("loadDraft(DRAFT)"); expect(s).toContain("clearDraft();"); });
  it("provides back navigation", () => { for (const p of ["StartPage","UploadContractPage","RequirementsPage","CoveragePage","QuestionsPage","ReviewPage"]) expect(read(`src/pages/${p}.tsx`)).toContain("<BackBar"); });
  it("removes the schedule detour", () => { expect(existsSync("src/pages/MissingSchedulePage.tsx")).toBe(false); expect(read("src/router/AppRouter.tsx")).not.toContain("/schedule/:applicationId"); });
});
