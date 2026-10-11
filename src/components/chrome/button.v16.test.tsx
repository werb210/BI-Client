// BI_CLIENT_DESIGN_v16 - the primary button is gold with navy text on every
// other Boreal property. This one was the outlier.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { screen } from "@testing-library/react";
import { controls, PAGE_NAMES, renderLoadedPage, stubApi, type PageName } from "@/test-utils/chrome-pages";
import { backgroundOf, colorOf, declared, rgb, stateRules } from "@/test-utils/chrome-dom";

const GOLD = rgb("#BF9B49");
const NAVY = rgb("#0B1F3A");
const WHITE = rgb("#ffffff");

// The main action each page offers once it has loaded.
const PRIMARY: Record<PageName, string> = {
  CoveragePage: "Continue with 1",
  HomePage: "Upload my subcontract",
  QuestionsPage: "Continue",
  RequirementsPage: "Choose your coverage",
  ReviewPage: "Submit my application",
  SignInPage: "Send code",
  StartPage: "Continue",
  UploadContractPage: "Choose file",
};

beforeEach(() => { stubApi(); });
afterEach(() => { vi.unstubAllGlobals(); });

describe("primary button matches the other properties", () => {
  for (const name of PAGE_NAMES) {
    it(`${name}: the primary action is gold with navy text`, async () => {
      await renderLoadedPage(name);
      const button = screen.getByRole("button", { name: PRIMARY[name] });
      expect(backgroundOf(button)).toBe(GOLD);
      expect(colorOf(button)).toBe(NAVY);
    });

    it(`${name}: no button is white on gold, which fails WCAG AA`, async () => {
      const { container } = await renderLoadedPage(name);
      const buttons = controls(container).filter((el) => el.tagName === "BUTTON");
      expect(buttons.length).toBeGreaterThan(0);
      for (const b of buttons) {
        if (backgroundOf(b) === GOLD) expect(colorOf(b)).not.toBe(WHITE);
      }
    });

    it(`${name}: no button uses a navy ground with white text`, async () => {
      const { container } = await renderLoadedPage(name);
      for (const b of controls(container).filter((el) => el.tagName === "BUTTON")) {
        expect(`${backgroundOf(b)} / ${colorOf(b)}`).not.toBe(`${NAVY} / ${WHITE}`);
      }
    });
  }
});

describe("interactive states", () => {
  // jsdom cannot hover or press, so these read the rules the stylesheet would
  // apply to the rendered button in that state.
  it("an inline-styled gold button lightens to #cfa953 on hover", async () => {
    await renderLoadedPage("HomePage");
    const button = screen.getByRole("button", { name: "Upload my subcontract" });
    expect(declared(stateRules(button, "hover"), "background")).toBe("#cfa953");
  });

  it("the hover colour is not applied to a disabled button", async () => {
    await renderLoadedPage("SignInPage");
    const send = screen.getByRole("button", { name: "Send code" });
    expect((send as HTMLButtonElement).disabled).toBe(true); // no number typed yet
    expect(declared(stateRules(send, "hover"), "background")).toBe("");
  });

  it("buttons press down 1px while active, but not when disabled", async () => {
    await renderLoadedPage("HomePage");
    const button = screen.getByRole("button", { name: "Upload my subcontract" });
    expect(declared(stateRules(button, "active"), "transform")).toBe("translateY(1px)");
    button.setAttribute("disabled", "");
    expect(declared(stateRules(button, "active"), "transform")).toBe("");
  });
});
