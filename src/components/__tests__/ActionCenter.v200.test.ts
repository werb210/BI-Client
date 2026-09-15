// BI_CLIENT_ACTION_CENTER_v200
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
const cmp = readFileSync("src/components/ActionCenter.tsx", "utf-8");
const page = readFileSync("src/pages/RequirementsPage.tsx", "utf-8");
describe("bi action center", () => {
  it("does not re-derive completion on the client", () => { expect(cmp).not.toMatch(/review_status|purged_at|required.*TRUE/); expect(cmp).toContain("/applicants/action-center/"); });
  it("renders nothing rather than blanking the page on failure", () => { expect(cmp).toContain("if (failed || !data) return null;"); });
  it("tells the applicant when a document was rejected", () => { expect(cmp).toContain("the last one was not accepted"); });
  it("refreshes on focus and cleans the listener up", () => { expect(cmp).toContain('window.addEventListener("focus", onFocus)'); expect(cmp).toContain('window.removeEventListener("focus", onFocus)'); });
  it("stays quiet when there is nothing at all to show", () => { expect(cmp).toContain("if (outstanding.length === 0 && completed.length === 0) return null;"); });
});
describe("mounting", () => { it("is on the requirements page, which has the application id", () => { expect(page).toContain("BI_CLIENT_ACTION_CENTER_v200"); expect(page).toContain("<ActionCenter applicationId={applicationId} />"); }); });
