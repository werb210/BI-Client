// BI_CLIENT_SHELL_v18 - the palette was right but the structure was not:
// content floated on white, and each page chose its own width.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { renderLoadedPage, stubApi } from "@/test-utils/chrome-pages";
import { backgroundOf, declared, matchedRules, mediaRules, rgb } from "@/test-utils/chrome-dom";

beforeEach(() => { stubApi(); });
afterEach(() => { vi.unstubAllGlobals(); });

const css = (el: Element) => getComputedStyle(el);

function renderShell() {
  const { container } = render(
    <div className="bi-page">
      <div className="bi-page__inner" data-testid="inner">
        <div className="bi-card" data-testid="card"><h1>Title</h1></div>
      </div>
      <div className="bi-page__inner bi-page__inner--narrow" data-testid="narrow" />
    </div>,
  );
  return container.querySelector(".bi-page")!;
}

describe("the page shell exists", () => {
  it("puts content on a mist ground", () => {
    const page = renderShell();
    expect(css(page).getPropertyValue("background")).toBe("var(--boreal-mist)");
    expect(backgroundOf(page)).toBe(rgb("#F5F8FC"));
  });

  it("gives content a bordered card, like every other property", () => {
    renderShell();
    const card = screen.getByTestId("card");
    expect(backgroundOf(card)).toBe(rgb("#ffffff"));
    // jsdom leaves a var() border out of getComputedStyle; read the cascade
    expect(declared(matchedRules(card), "border")).toBe("1px solid #E4EAF2");
    expect(css(card).borderRadius).toBe("12px");
  });

  it("sets width centrally rather than per page", () => {
    renderShell();
    const inner = screen.getByTestId("inner");
    expect(css(inner).maxWidth).toBe("620px");
    expect(css(inner).marginLeft).toBe("auto");
    expect(css(inner).marginRight).toBe("auto");
    expect(css(screen.getByTestId("narrow")).maxWidth).toBe("460px");
  });

  it("adapts on a phone", () => {
    const page = renderShell();
    // jsdom does not apply @media; read what the phone rule gives each piece.
    expect(declared(mediaRules(page, "(max-width: 640px)"), "padding")).toBe("20px 12px 40px");
    expect(declared(mediaRules(screen.getByTestId("card"), "(max-width: 640px)"), "padding")).toBe("20px 16px");
    expect(declared(mediaRules(screen.getByRole("heading"), "(max-width: 640px)"), "font-size")).toBe("24px");
    expect(css(page).paddingTop).toBe("32px");
  });
});

describe("sign-in uses it", () => {
  it("renders inside the shell", async () => {
    const { container } = await renderLoadedPage("SignInPage");
    const page = container.firstElementChild as HTMLElement;
    expect(page.className).toBe("bi-page");
    expect(backgroundOf(page)).toBe(rgb("#F5F8FC"));
    const card = page.querySelector(".bi-page__inner--narrow > .bi-card")!;
    expect(card).not.toBeNull();
    expect(card.contains(screen.getByLabelText("Mobile number"))).toBe(true);
    expect(card.contains(screen.getByRole("heading", { name: "Boreal Risk Management" }))).toBe(true);
    expect(css(card).borderRadius).toBe("12px");
  });

  it("no longer hardcodes its own width", async () => {
    const { container } = await renderLoadedPage("SignInPage");
    for (const el of Array.from(container.querySelectorAll<HTMLElement>("*"))) {
      expect(el.style.maxWidth).toBe("");
    }
    // the width it gets is the shared narrow column
    expect(css(container.querySelector(".bi-page__inner")!).maxWidth).toBe("460px");
  });
});
