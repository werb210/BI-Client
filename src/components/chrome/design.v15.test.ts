// BI_CLIENT_DESIGN_v15 - the pages are inline-styled with no tokens file, so
// the guard is that the old generic hex values are gone and the root rules
// carrying the brand type are present.
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

const read = (p: string) => readFileSync(path.join(process.cwd(), p), "utf8");

const CSS = read("src/components/chrome/chrome.css");
const HTML = read("index.html");

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

describe("pages use the brand palette", () => {
  for (const stale of ["#1E3A8A", "#475569", "#cbd5e1", "#334155", "#0f172a"]) {
    it(`no longer contains ${stale}`, () => {
      expect(pageSources).not.toContain(stale);
    });
  }

  it("uses boreal ink and body instead", () => {
    expect(pageSources).toContain("#0B1F3A");
    expect(pageSources).toContain("#51617D");
  });
});

describe("typography matches BF-Website", () => {
  it("loads both faces without blocking render", () => {
    expect(HTML).toContain("Libre+Caslon+Text");
    expect(HTML).toContain("Public+Sans");
    expect(HTML).toContain('media="print"');
  });

  it("applies them at the root", () => {
    expect(CSS).toContain('font-family: "Public Sans"');
    expect(CSS).toContain('font-family: "Libre Caslon Text"');
  });

  it("exposes the palette as variables", () => {
    expect(CSS).toContain("--boreal-gold: #BF9B49");
    expect(CSS).toContain("--boreal-line: #E4EAF2");
  });

  it("gives focusable elements a visible ring", () => {
    expect(CSS).toContain(":focus-visible");
    expect(CSS).toContain("rgba(191, 155, 73, 0.45)");
  });
});
