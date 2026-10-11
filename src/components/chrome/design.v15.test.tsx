// BI_CLIENT_DESIGN_v15 - the pages are inline-styled with no tokens file, so
// the guard is that the old generic hex values are gone from what the pages
// render and the root rules carrying the brand type are applied.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { readFileSync } from "node:fs";
import path from "node:path";
import { PAGE_NAMES, renderLoadedPage, stubApi } from "@/test-utils/chrome-pages";
import { cssVar, declared, rgb, stateRules } from "@/test-utils/chrome-dom";

// index.html is the page shell outside src/; parse it as the browser would.
const HTML = new DOMParser().parseFromString(readFileSync(path.join(process.cwd(), "index.html"), "utf8"), "text/html");

beforeEach(() => { stubApi(); });
afterEach(() => { vi.unstubAllGlobals(); });

/** Every inline style the loaded pages paint with, one string. */
async function renderedStyles(): Promise<string> {
  const out: string[] = [];
  for (const name of PAGE_NAMES) {
    const { container, unmount } = await renderLoadedPage(name);
    for (const el of Array.from(container.querySelectorAll("[style]"))) out.push(el.getAttribute("style") ?? "");
    unmount();
  }
  return out.join("\n").toLowerCase();
}

describe("pages use the brand palette", () => {
  for (const stale of ["#1E3A8A", "#475569", "#cbd5e1", "#334155", "#0f172a"]) {
    it(`no page renders ${stale}`, async () => {
      const styles = await renderedStyles();
      expect(styles.length).toBeGreaterThan(0);
      expect(styles).not.toContain(rgb(stale));
      expect(styles).not.toContain(stale.toLowerCase());
    });
  }

  it("uses boreal ink and body instead", async () => {
    const styles = await renderedStyles();
    expect(styles).toContain(rgb("#0B1F3A"));
    expect(styles).toContain(rgb("#51617D"));
  });
});

describe("typography matches BF-Website", () => {
  it("loads both faces without blocking render", () => {
    const sheet = Array.from(HTML.querySelectorAll<HTMLLinkElement>('head > link[rel="stylesheet"]'))
      .find((l) => (l.getAttribute("href") ?? "").includes("fonts.googleapis.com"));
    expect(sheet).toBeDefined();
    const href = sheet!.getAttribute("href")!;
    expect(href).toContain("Libre+Caslon+Text");
    expect(href).toContain("Public+Sans");
    // loads as print (non-blocking), then switches itself to all
    expect(sheet!.getAttribute("media")).toBe("print");
    expect(sheet!.getAttribute("onload")).toContain("this.media='all'");
  });

  it("applies them at the root", async () => {
    await renderLoadedPage("CoveragePage");
    expect(getComputedStyle(document.body).fontFamily).toMatch(/^"Public Sans"/);
    expect(getComputedStyle(document.documentElement).fontFamily).toMatch(/^"Public Sans"/);
    const heading = screen.getByRole("heading", { name: "What do you need covered?" });
    expect(getComputedStyle(heading).fontFamily).toMatch(/^"Libre Caslon Text"/);
  });

  it("exposes the palette as variables", () => {
    expect(cssVar("--boreal-gold")).toBe("#BF9B49");
    expect(cssVar("--boreal-line")).toBe("#E4EAF2");
    expect(cssVar("--boreal-ink")).toBe("#0B1F3A");
  });

  it("gives focusable elements a visible ring", () => {
    const { container } = render(<div><input /><button type="button">b</button><a href="#x">a</a><select /><textarea /></div>);
    for (const el of Array.from(container.querySelectorAll("input, button, a, select, textarea"))) {
      expect(declared(stateRules(el, "focus-visible"), "box-shadow")).toBe("0 0 0 3px rgba(191, 155, 73, 0.45)");
      expect(declared(stateRules(el, "focus-visible"), "outline")).toBe("none");
    }
  });
});
