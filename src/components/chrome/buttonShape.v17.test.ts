// BI_CLIENT_DESIGN_v17 - controls should be the same size and shape as the
// ones on bf-client and bi-website.
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

const read = (p: string) => readFileSync(path.join(process.cwd(), p), "utf8");

const PAGES = [
  "CoveragePage",
  "HomePage",
  "QuestionsPage",
  "RequirementsPage",
  "ReviewPage",
  "SignInPage",
  "StartPage",
  "UploadContractPage",
];

const pageSources = PAGES.map((f) => read(`src/pages/${f}.tsx`)).join("\n");
const CSS = read("src/components/chrome/chrome.css");

describe("controls share one shape", () => {
  it("uses a single 8px radius", () => {
    expect(pageSources).toContain("borderRadius: 8");
    expect(pageSources).not.toContain("borderRadius: 10");
    expect(pageSources).not.toContain("borderRadius: 12");
    expect(pageSources).not.toContain("borderRadius: 999");
  });

  it("keeps the locked mobile touch targets", () => {
    // ruling 23: 56px primary, 44px floor. Deliberate, not drift.
    expect(pageSources).toContain("minHeight: 56");
    expect(pageSources).toContain("minHeight: 44");
  });
});

describe("motion matches the other properties", () => {
  it("uses the shared transition", () => {
    expect(CSS).toContain("transform 60ms ease");
    expect(CSS).toContain("background-color 120ms ease");
  });
});
