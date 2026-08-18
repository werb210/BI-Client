// BI_CLIENT_CTA_v23 - the primary button was declared five times with the same
// values and no hover, active or disabled states.
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

const read = (p: string) => readFileSync(path.join(process.cwd(), p), "utf8");

const CSS = read("src/components/chrome/chrome.css");
const PAGES = {
  CoveragePage: read("src/pages/CoveragePage.tsx"),
  QuestionsPage: read("src/pages/QuestionsPage.tsx"),
  ReviewPage: read("src/pages/ReviewPage.tsx"),
};

describe("one primary action", () => {
  it("keeps the locked 56px touch target", () => {
    const cta = CSS.slice(CSS.indexOf(".bi-cta {"), CSS.indexOf(".bi-cta--inline"));
    expect(cta).toContain("min-height: 56px");
    expect(cta).toContain("background: var(--boreal-gold)");
    expect(cta).toContain("color: var(--boreal-ink)");
  });

  it("has the states inline styles cannot express", () => {
    expect(CSS).toContain(".bi-cta:hover:not(:disabled)");
    expect(CSS).toContain(".bi-cta:active:not(:disabled)");
    expect(CSS).toContain(".bi-cta:focus-visible");
    expect(CSS).toContain(".bi-cta:disabled");
  });

  it("has a variant for the two-button rows", () => {
    expect(CSS).toContain(".bi-cta--inline { width: auto; flex: 1; }");
  });
});

describe("every page uses it", () => {
  for (const [name, src] of Object.entries(PAGES)) {
    it(`${name} no longer declares its own gold button`, () => {
      expect(src).toContain('className="bi-cta');
      expect(src).not.toContain('background: "#BF9B49", color: "#0B1F3A", cursor: "pointer"');
    });

    it(`${name} drops the opacity fade for a real disabled state`, () => {
      expect(src).not.toContain("...cta, opacity:");
    });
  }
});

describe("the duplicate field is gone", () => {
  it("Questions uses the shared field", () => {
    expect(PAGES.QuestionsPage).toContain('className="bi-field"');
    expect(PAGES.QuestionsPage).toContain("const field: React.CSSProperties = { marginTop: 12 };");
  });
});
