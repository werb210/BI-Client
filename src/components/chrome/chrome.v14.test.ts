// BI_CLIENT_CHROME_v14 - assert geometry against BF-Website's template values.
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

const read = (p: string) => readFileSync(path.join(process.cwd(), p), "utf8");
const CSS = read("src/components/chrome/chrome.css");
const HEADER = read("src/components/chrome/Header.tsx");
const FOOTER = read("src/components/chrome/Footer.tsx");
const APP = read("src/App.tsx");

describe("header geometry matches the BF-Website template", () => {
  it("80px row in a 1120px container with 24px padding", () => {
    expect(CSS).toContain("min-height: 80px");
    expect(CSS).toContain("max-width: 1120px");
    expect(CSS).toContain("padding: 0.75rem 24px");
  });
  it("40px logo, 16px wordmark rising to 20px", () => {
    expect(CSS).toContain("height: 40px");
    expect(CSS).toContain("font-size: 16px");
    expect(CSS).toContain("font-size: 20px");
  });
  it("14px nav, 24px gap, 768px breakpoint, hover state", () => {
    expect(CSS).toContain("gap: 24px");
    expect(CSS).toContain("@media (min-width: 768px)");
    expect(CSS).toContain(".bi-chrome-nav a:hover");
  });
});

describe("footer geometry matches the BF-Website template", () => {
  it("uses the template shell and container", () => {
    expect(CSS).toContain("background: #0a1120");
    expect(CSS).toContain("border-top: 1px solid #1c2538");
    expect(CSS).toContain("max-width: 1200px");
  });
  it("uses the template grid, gap and bottom bar size", () => {
    expect(CSS).toContain("repeat(auto-fit, minmax(220px, 1fr))");
    expect(CSS).toContain("gap: 32px");
    expect(CSS).toContain("font-size: 12px");
  });
});

describe("chrome is actually mounted", () => {
  it("wraps every route in App.tsx", () => {
    expect(APP).toContain("<Header />");
    expect(APP).toContain("<Footer />");
    expect(APP).toContain("<AppRouter />");
  });
  it("pins the footer to the bottom", () => expect(APP).toContain("minHeight: \"100vh\""));
});

describe("BI brand and compliance", () => {
  it("carries BI's name, not Boreal Financial's", () => {
    expect(HEADER).toContain("Boreal Risk Management");
    expect(FOOTER).toContain("Boreal Risk Management");
  });
  it("keeps the referral-partner disclosure and Quebec exclusion", () => {
    expect(FOOTER).toContain("not a licensed");
    expect(FOOTER).toContain("Not available to Quebec residents");
  });
});
