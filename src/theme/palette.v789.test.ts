// BI_CLIENT_v789_READABILITY - every text/background pair the audit named reaches 4.5:1.
import { describe, expect, it } from "vitest";
import "@/components/chrome/chrome.css";
import { contrastRatio, DISABLED_TEXT, HINT_TEXT, LINE, MIST, NAVY_CHIP, NAVY_SECONDARY, over, parseColor, WHITE } from "./palette";

const AA = 4.5;

describe("contrast maths", () => {
  it("matches known WCAG values", () => {
    expect(contrastRatio("#000000", "#ffffff")).toBeCloseTo(21, 5);
    expect(contrastRatio("#ffffff", "#ffffff")).toBeCloseTo(1, 5);
    // The old hint grey failed AA on white.
    expect(contrastRatio("#8593aa", WHITE)).toBeLessThan(AA);
  });
  it("paints a translucent colour over its ground", () => {
    expect(over("rgba(0,0,0,0.5)", "#ffffff")).toBe("rgb(128, 128, 128)");
    expect(parseColor("#fff")).toEqual({ r: 255, g: 255, b: 255, a: 1 });
  });
});

describe("audited pairs", () => {
  const pairs: Array<[string, string, string]> = [
    ["hint text on white (Messages, Questions, Review, Requirements, Upload, Start)", HINT_TEXT, WHITE],
    ["hint text on the page ground", HINT_TEXT, MIST],
    ["placeholder (--boreal-muted) in a white field", HINT_TEXT, WHITE],
    ["disabled button label on its grey", DISABLED_TEXT, LINE],
    ["action center secondary navy on white", NAVY_SECONDARY, WHITE],
    ["action center step number on its chip", NAVY_SECONDARY, over(NAVY_CHIP, WHITE)],
  ];
  for (const [name, fg, bg] of pairs) {
    it(`${name} reaches 4.5:1`, () => {
      expect(contrastRatio(fg, bg)).toBeGreaterThanOrEqual(AA);
    });
  }
  it("action center navy is at least 75% opaque", () => {
    expect(parseColor(NAVY_SECONDARY).a).toBeGreaterThanOrEqual(0.75);
  });
});

describe("the stylesheet uses the audited colours", () => {
  it("renders a disabled call to action in #374151", () => {
    document.body.innerHTML = '<button class="bi-cta" disabled>Continue</button>';
    const style = getComputedStyle(document.querySelector("button")!);
    expect(parseColor(style.color)).toEqual(parseColor(DISABLED_TEXT));
  });
  it("sets --boreal-muted (placeholders) to the hint colour", () => {
    const muted = getComputedStyle(document.documentElement).getPropertyValue("--boreal-muted").trim();
    expect(muted.toLowerCase()).toBe(HINT_TEXT.toLowerCase());
  });
});
