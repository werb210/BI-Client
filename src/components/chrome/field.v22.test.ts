// BI_CLIENT_FIELD_v22 - the sign-in field was ~44px where every later field
// was 56, so the first control a user touches did not match the rest.
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

const read = (p: string) => readFileSync(path.join(process.cwd(), p), "utf8");

const CSS = read("src/components/chrome/chrome.css");
const SIGNIN = read("src/pages/SignInPage.tsx");
const START = read("src/pages/StartPage.tsx");

describe("one field treatment", () => {
  it("honours the locked 56px mobile touch target", () => {
    const field = CSS.slice(CSS.indexOf(".bi-field {"), CSS.indexOf(".bi-field::placeholder"));
    expect(field).toContain("min-height: 56px");
    expect(field).toContain("border-radius: 8px");
  });

  it("rings gold on focus, like every other property", () => {
    expect(CSS).toContain(".bi-field:focus");
    expect(CSS).toContain("rgba(191, 155, 73, 0.45)");
  });

  it("handles textarea, which cannot use a fixed height", () => {
    expect(CSS).toContain("textarea.bi-field");
  });
});

describe("both pages use it", () => {
  it("sign-in no longer defines a shorter field", () => {
    expect(SIGNIN).toContain('className="bi-field"');
    expect(SIGNIN).not.toContain('padding: "12px 14px"');
  });

  it("start keeps its behaviour and gains the ring", () => {
    expect(START).toContain('className="bi-field"');
    // the const input object is now empty; the CTA button keeps its own 56px,
    // which is a button height, not a field height.
    expect(START).toContain("const input: React.CSSProperties = {};");
  });

  it("the read-only phone field matches too", () => {
    expect(START).toContain('className="bi-field" style={readOnly}');
  });
});
