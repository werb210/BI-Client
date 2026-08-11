// BI_CLIENT_INDUSTRY_v11
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
const read = (p: string) => readFileSync(path.join(process.cwd(), p), "utf8");
const start = read("src/pages/StartPage.tsx");
const coverage = read("src/pages/CoveragePage.tsx");
const entry = read("src/entry/entryContext.ts");
const app = read("src/App.tsx");
const profileApi = read("src/api/profile.ts");
const productsApi = read("src/api/products.ts");
describe("industry is asked first and decides the path", () => {
  it("renders the dropdown above every other field", () => expect(start.indexOf('data-testid="industry-select"')).toBeLessThan(start.indexOf('htmlFor="businessName"')));
  it("has no default", () => { expect(start).toContain('<option value="">Choose your industry</option>'); expect(start).toContain("industry.trim().length > 0"); });
  it("branches", () => expect(start).toContain('navigate(result.wantsContract ? "/upload" : "/coverage/me");'));
  it("loads industries", () => { expect(profileApi).toContain('api.get<{ industries: Industry[] }>("/applicants/industries")'); expect(start).toContain("listIndustries()"); });
});
describe("entry link", () => {
  it("captures at boot", () => expect(app).toContain('captureEntryParams(typeof window === "undefined" ? "" : window.location.search);'));
  it("reads sanitized params", () => { expect(entry).toContain('params.get("industry")'); expect(entry).toContain('params.get("src")'); expect(entry).toContain('replace(/[^a-z0-9_-]/g, "")'); });
  it("preselects and passes source", () => { expect(start).toContain("useState(getEntryIndustry())"); expect(start).toContain("getEntrySource() || undefined"); });
});
describe("industry coverage", () => {
  it("queries industry", () => { expect(productsApi).toContain('query.set("industry", industry)'); expect(coverage).toContain("getChosenIndustry() || undefined"); });
  it("shows category contract upload", () => { expect(coverage).toContain('setCategories(list.kind === "categories")'); expect(coverage).toContain('data-testid="upload-other-contract"'); });
});
