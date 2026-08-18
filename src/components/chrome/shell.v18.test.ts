// BI_CLIENT_SHELL_v18 - the palette was right but the structure was not:
// content floated on white, and each page chose its own width.
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

const read = (p: string) => readFileSync(path.join(process.cwd(), p), "utf8");

const CSS = read("src/components/chrome/chrome.css");
const SIGNIN = read("src/pages/SignInPage.tsx");

describe("the page shell exists", () => {
  it("puts content on a mist ground", () => {
    expect(CSS).toContain(".bi-page {");
    expect(CSS).toContain("background: var(--boreal-mist)");
  });

  it("gives content a bordered card, like every other property", () => {
    expect(CSS).toContain(".bi-card {");
    expect(CSS).toContain("border: 1px solid var(--boreal-line)");
    expect(CSS).toContain("border-radius: 12px");
  });

  it("sets width centrally rather than per page", () => {
    expect(CSS).toContain(".bi-page__inner");
    expect(CSS).toContain("max-width: 620px");
    expect(CSS).toContain(".bi-page__inner--narrow");
  });

  it("adapts on a phone", () => {
    expect(CSS).toContain("@media (max-width: 640px)");
  });
});

describe("sign-in uses it", () => {
  it("renders inside the shell", () => {
    expect(SIGNIN).toContain('className="bi-page"');
    expect(SIGNIN).toContain('className="bi-card"');
  });

  it("no longer hardcodes its own width", () => {
    expect(SIGNIN).not.toContain("maxWidth: 420");
  });
});
