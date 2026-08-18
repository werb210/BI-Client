// BI_CLIENT_SHELL_v21 - these three pages have early returns for loading,
// empty and done. Converting only the main return leaves a user on an
// unstyled page every visit, because loading fires first every time.
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

const read = (p: string) => readFileSync(path.join(process.cwd(), p), "utf8");

const PAGES = {
  CoveragePage: read("src/pages/CoveragePage.tsx"),
  QuestionsPage: read("src/pages/QuestionsPage.tsx"),
  ReviewPage: read("src/pages/ReviewPage.tsx"),
};
const CSS = read("src/components/chrome/chrome.css");

describe("every render state uses the shell", () => {
  for (const [name, src] of Object.entries(PAGES)) {
    it(`${name} has no bare wrapper left`, () => {
      expect(src).not.toContain("<div style={wrap}>");
    });

    it(`${name} renders the shell`, () => {
      expect(src).toContain('className="bi-page"');
    });

    it(`${name} no longer sets its own width`, () => {
      expect(src).not.toContain("maxWidth: 620");
      expect(src).not.toContain("maxWidth: 680");
    });
  }
});

describe("the fixed CTA bars still clear the content", () => {
  it("Coverage keeps 104px", () => {
    expect(PAGES.CoveragePage).toContain("paddingBottom: 104");
  });

  it("Questions and Review keep 120px", () => {
    expect(PAGES.QuestionsPage).toContain("paddingBottom: 120");
    expect(PAGES.ReviewPage).toContain("paddingBottom: 120");
  });
});

describe("the shell centres direct children", () => {
  it("so early-return states land on the shared width", () => {
    expect(CSS).toContain(".bi-page > *:not(.bi-page__inner)");
    expect(CSS).toContain("max-width: 620px");
  });
});
