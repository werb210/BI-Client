// BI_CLIENT_SHELL_v21 - these three pages have early returns for loading,
// empty and done. Converting only the main return leaves a user on an
// unstyled page every visit, because loading fires first every time.
import { afterEach, describe, expect, it, vi } from "vitest";
import { screen } from "@testing-library/react";
import { FIXTURES, PENDING, renderPage, stubApi, type ApiRoutes, type PageName } from "@/test-utils/chrome-pages";
import { backgroundOf, rgb } from "@/test-utils/chrome-dom";

afterEach(() => { vi.unstubAllGlobals(); });

type State = { state: string; routes: ApiRoutes; shows: string | RegExp };
type ShellPage = { name: PageName; bottom: string; states: State[] };

const pending = (path: RegExp): ApiRoutes => [["GET", path, PENDING]];

const PAGES: ShellPage[] = [
  {
    name: "CoveragePage",
    bottom: "104px",
    states: [
      { state: "loading", routes: pending(/\/products$/), shows: "Loading\u2026" },
      { state: "main", routes: [], shows: "What do you need covered?" },
      { state: "load error", routes: [["GET", /\/products$/, { status: 500, body: { error: "boom" } }]], shows: "We could not load the coverage list. Please refresh." },
    ],
  },
  {
    name: "QuestionsPage",
    bottom: "120px",
    states: [
      { state: "loading", routes: pending(/\/questions$/), shows: "Loading\u2026" },
      { state: "empty", routes: [["GET", /\/questions$/, { ...FIXTURES.questions, questions: [] }]], shows: "Nothing to answer yet" },
      { state: "main", routes: [], shows: "About you" },
    ],
  },
  {
    name: "ReviewPage",
    bottom: "120px",
    states: [
      { state: "loading", routes: pending(/\/summary$/), shows: "Loading\u2026" },
      { state: "not found", routes: [["GET", /\/summary$/, { status: 500, body: { error: "boom" } }]], shows: "We could not load your application. Please refresh." },
      { state: "done", routes: [["GET", /\/summary$/, { ...FIXTURES.summary, status: "ready_for_submission" }]], shows: "That's everything we need" },
      { state: "main", routes: [], shows: "Check this over" },
    ],
  },
];

async function renderState(name: PageName, s: State) {
  stubApi(s.routes);
  const { container } = renderPage(name);
  await screen.findByText(s.shows);
  return container.firstElementChild as HTMLElement;
}

describe("every render state uses the shell", () => {
  for (const page of PAGES) {
    for (const s of page.states) {
      it(`${page.name} (${s.state}) has no bare wrapper left`, async () => {
        const root = await renderState(page.name, s);
        expect(root.tagName).toBe("DIV");
        expect(root.className).toBe("bi-page");
        expect(backgroundOf(root)).toBe(rgb("#F5F8FC"));
      });

      it(`${page.name} (${s.state}) no longer sets its own width`, async () => {
        const root = await renderState(page.name, s);
        for (const el of [root, ...Array.from(root.querySelectorAll<HTMLElement>("*"))]) {
          expect(el.style.maxWidth).toBe("");
        }
      });

      it(`${page.name} (${s.state}) keeps its fixed CTA bar clear`, async () => {
        const root = await renderState(page.name, s);
        expect(root.style.paddingBottom).toBe(page.bottom);
      });
    }
  }
});

describe("the shell centres direct children", () => {
  it("so early-return states land on the shared width", async () => {
    const root = await renderState("QuestionsPage", PAGES[1].states[1]);
    const heading = screen.getByRole("heading", { name: "Nothing to answer yet" });
    expect(heading.parentElement).toBe(root);
    expect(getComputedStyle(heading).maxWidth).toBe("620px");
    // (jsdom ignores selector specificity, so the later ".bi-page h1" margin
    // shadows the centring margin on the heading there; the paragraph shows it.)
    const blurb = screen.getByText(/Choose your coverage first/);
    expect(blurb.parentElement).toBe(root);
    expect(getComputedStyle(blurb).maxWidth).toBe("620px");
    expect(getComputedStyle(blurb).marginLeft).toBe("auto");
    expect(getComputedStyle(blurb).marginRight).toBe("auto");
  });

  it("including the done state's cards", async () => {
    const root = await renderState("ReviewPage", PAGES[2].states[2]);
    const children = Array.from(root.children);
    expect(children.length).toBeGreaterThan(1);
    for (const child of children) expect(getComputedStyle(child).maxWidth).toBe("620px");
  });
});
