// BI_CLIENT_CTA_v23 - the primary button was declared five times with the same
// values and no hover, active or disabled states.
import { afterEach, describe, expect, it, vi } from "vitest";
import { fireEvent, screen } from "@testing-library/react";
import { FIXTURES, PENDING, renderLoadedPage, stubApi, type PageName } from "@/test-utils/chrome-pages";
import { backgroundOf, colorOf, cssVar, declared, rgb, stateRules } from "@/test-utils/chrome-dom";

afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });

const GOLD = rgb("#BF9B49");
const NAVY = rgb("#0B1F3A");
const css = (el: Element) => getComputedStyle(el);

type CtaPage = "CoveragePage" | "QuestionsPage" | "ReviewPage";
// Each page's primary action, and how to bring it to its disabled state.
const PAGES: Record<CtaPage, { label: string; disabledLabel: string; disable: () => Promise<void> }> = {
  CoveragePage: {
    label: "Continue with 1",
    disabledLabel: "Select at least one",
    // nothing chosen yet
    disable: async () => {
      stubApi([["GET", /\/products$/, { ...FIXTURES.selection, selected: [] }]]);
      await renderLoadedPage("CoveragePage");
    },
  },
  QuestionsPage: {
    label: "Continue",
    disabledLabel: "Saving...",
    // the CTA disables itself while the answers are saving
    disable: async () => {
      vi.spyOn(window, "scrollTo").mockImplementation(() => undefined);
      stubApi([["POST", /\/answers$/, PENDING]]);
      await renderLoadedPage("QuestionsPage");
      fireEvent.change(screen.getByLabelText("Your full legal name"), { target: { value: "Pat Doe" } });
      fireEvent.change(screen.getByLabelText("Province of residence"), { target: { value: "Ontario" } });
      fireEvent.click(screen.getByRole("button", { name: "Continue" }));
      fireEvent.click(await screen.findByRole("button", { name: "No" }));
      fireEvent.click(screen.getByRole("button", { name: "Finish" }));
    },
  },
  ReviewPage: {
    label: "Submit my application",
    disabledLabel: "Finish the items above",
    // the server says the application is not complete
    disable: async () => {
      stubApi([["GET", /\/summary$/, { ...FIXTURES.summary, canSubmit: false }]]);
      await renderLoadedPage("ReviewPage");
    },
  },
};

async function primary(name: PageName, label: string) {
  await renderLoadedPage(name);
  return screen.getByRole("button", { name: label });
}

describe("one primary action", () => {
  it("keeps the locked 56px touch target, gold with navy text", async () => {
    stubApi();
    const cta = await primary("CoveragePage", "Continue with 1");
    expect(css(cta).minHeight).toBe("56px");
    expect(css(cta).getPropertyValue("background")).toBe("var(--boreal-gold)");
    expect(css(cta).color).toBe("var(--boreal-ink)");
    expect(backgroundOf(cta)).toBe(GOLD);
    expect(colorOf(cta)).toBe(NAVY);
  });

  it("has the states inline styles cannot express", async () => {
    stubApi();
    const cta = await primary("CoveragePage", "Continue with 1");
    expect(declared(stateRules(cta, "hover"), "background")).toBe(cssVar("--boreal-gold-hover"));
    expect(cssVar("--boreal-gold-hover")).toBe("#cfa953");
    expect(declared(stateRules(cta, "active"), "transform")).toBe("translateY(1px)");
    expect(declared(stateRules(cta, "focus-visible"), "box-shadow")).toBe("0 0 0 3px rgba(191, 155, 73, 0.45)");
  });

  it("has a real disabled state, without hover or press", async () => {
    stubApi([["GET", /\/products$/, { ...FIXTURES.selection, selected: [] }]]);
    const cta = await primary("CoveragePage", "Select at least one");
    expect((cta as HTMLButtonElement).disabled).toBe(true);
    expect(backgroundOf(cta)).toBe(rgb("#E4EAF2"));
    expect(colorOf(cta)).toBe(rgb("#374151"));
    expect(css(cta).cursor).toBe("not-allowed");
    expect(css(cta).transform).toBe("none");
    expect(declared(stateRules(cta, "hover"), "background")).toBe("");
    expect(declared(stateRules(cta, "active"), "transform")).toBe("");
  });

  it("has a variant for the two-button rows", async () => {
    stubApi();
    const cta = await primary("QuestionsPage", "Continue");
    expect(cta.classList.contains("bi-cta--inline")).toBe(true);
    expect(css(cta).width).toBe("auto");
    expect(css(cta).flexGrow).toBe("1");
    const plain = document.createElement("button");
    plain.className = "bi-cta";
    document.body.appendChild(plain);
    expect(css(plain).width).toBe("100%");
    plain.remove();
  });
});

describe("every page uses it", () => {
  for (const [name, page] of Object.entries(PAGES) as [CtaPage, (typeof PAGES)[CtaPage]][]) {
    it(`${name} no longer declares its own gold button`, async () => {
      stubApi();
      const cta = await primary(name, page.label);
      expect(cta.classList.contains("bi-cta")).toBe(true);
      expect(cta.style.background).toBe("");
      expect(cta.style.backgroundColor).toBe("");
      expect(cta.style.color).toBe("");
      expect(cta.style.cursor).toBe("");
      expect(backgroundOf(cta)).toBe(GOLD);
      expect(colorOf(cta)).toBe(NAVY);
    });

    it(`${name} drops the opacity fade for a real disabled state`, async () => {
      await page.disable();
      const cta = await screen.findByRole("button", { name: page.disabledLabel });
      expect((cta as HTMLButtonElement).disabled).toBe(true);
      expect(cta.style.opacity).toBe("");
      expect(css(cta).opacity === "" || css(cta).opacity === "1").toBe(true);
      expect(colorOf(cta)).toBe(rgb("#374151"));
      expect(backgroundOf(cta)).toBe(rgb("#E4EAF2"));
    });
  }
});

describe("the duplicate field is gone", () => {
  it("Questions uses the shared field, adding only a top margin", async () => {
    stubApi();
    await renderLoadedPage("QuestionsPage");
    for (const el of [screen.getByLabelText("Your full legal name"), screen.getByLabelText("Province of residence")]) {
      expect(el.classList.contains("bi-field")).toBe(true);
      expect(el.getAttribute("style")).toBe("margin-top: 12px;");
      expect(css(el).minHeight).toBe("56px");
      expect(css(el).borderRadius).toBe("8px");
    }
  });
});
