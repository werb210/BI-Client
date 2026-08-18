// BI_CLIENT_DESIGN_v16 - the primary button is gold with navy text on every
// other Boreal property. This one was the outlier.
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

describe("primary button matches the other properties", () => {
  it("is gold with navy text", () => {
    expect(pageSources).toContain('background: "#BF9B49", color: "#0B1F3A"');
  });

  it("is never white on gold, which fails WCAG AA", () => {
    expect(pageSources).not.toContain('background: "#BF9B49", color: "#fff"');
  });

  it("no longer uses a navy ground for the primary action", () => {
    expect(pageSources).not.toContain('background: "#0B1F3A", color: "#fff"');
  });
});

describe("interactive states", () => {
  it("hover and active come from the stylesheet", () => {
    expect(CSS).toContain("#cfa953");
    expect(CSS).toContain("button:active:not(:disabled)");
  });
});
