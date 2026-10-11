// BI_CLIENT_CHROME_v14 - assert geometry against BF-Website's template values.
import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import Header from "@/components/chrome/Header";
import Footer from "@/components/chrome/Footer";
import App from "@/App";
import { stubApi } from "@/test-utils/chrome-pages";
import { backgroundOf, colorOf, declared, mediaRules, rgb, stateRules } from "@/test-utils/chrome-dom";

afterEach(() => { vi.unstubAllGlobals(); });

const css = (el: Element) => getComputedStyle(el);

function renderHeader() {
  const { container } = render(<MemoryRouter><Header /></MemoryRouter>);
  return container.querySelector("header")!;
}
function renderFooter() {
  const { container } = render(<Footer />);
  return container.querySelector("footer")!;
}

describe("header geometry matches the BF-Website template", () => {
  it("80px row in a 1120px container with 24px padding", () => {
    const row = renderHeader().querySelector(".bi-chrome-header__row")!;
    expect(css(row).minHeight).toBe("80px");
    expect(css(row).maxWidth).toBe("1120px");
    expect(css(row).paddingLeft).toBe("24px");
    expect(css(row).paddingRight).toBe("24px");
    expect(css(row).paddingBottom).toBe("0.75rem");
    expect(css(row).paddingTop).toContain("0.75rem");
  });

  it("40px logo, 16px wordmark rising to 20px", () => {
    const header = renderHeader();
    const logo = within(header).getByRole("img", { name: "Boreal Risk Management" });
    expect(css(logo).height).toBe("40px");
    const wordmark = header.querySelector(".bi-chrome-brand span")!;
    expect(css(wordmark).fontSize).toBe("16px");
    // jsdom does not apply @media; read what the wide-screen rule gives it.
    expect(declared(mediaRules(wordmark, "(min-width: 640px)"), "font-size")).toBe("20px");
  });

  it("14px nav, 24px gap, shown from the 768px breakpoint, hover state", () => {
    const header = renderHeader();
    // hidden: true because the nav is display:none at jsdom's default width
    const nav = within(header).getByRole("navigation", { hidden: true });
    expect(css(nav).fontSize).toBe("14px");
    expect(css(nav).gap).toBe("24px");
    expect(css(nav).display).toBe("none");
    expect(declared(mediaRules(nav, "(min-width: 768px)"), "display")).toBe("flex");
    const faq = within(nav).getByRole("link", { name: "FAQ", hidden: true });
    expect(colorOf(faq)).toBe("rgba(255, 255, 255, 0.8)");
    expect(declared(stateRules(faq, "hover"), "color")).toBe("#fff");
  });
});

describe("footer geometry matches the BF-Website template", () => {
  it("uses the template shell and container", () => {
    const footer = renderFooter();
    expect(backgroundOf(footer)).toBe(rgb("#0a1120"));
    expect(css(footer).borderTopWidth).toBe("1px");
    expect(css(footer).borderTopStyle).toBe("solid");
    expect(rgb(css(footer).borderTopColor)).toBe(rgb("#1c2538"));
    expect(css(footer.querySelector(".bi-chrome-footer__inner")!).maxWidth).toBe("1200px");
  });

  it("uses the template grid, gap and bottom bar size", () => {
    const footer = renderFooter();
    const grid = footer.querySelector(".bi-chrome-footer__grid")!;
    expect(css(grid).display).toBe("grid");
    expect(css(grid).gridTemplateColumns).toBe("repeat(auto-fit, minmax(220px, 1fr))");
    expect(css(grid).gap).toBe("32px");
    const bar = footer.querySelector(".bi-chrome-footer__bar")!;
    expect(within(bar as HTMLElement).getByText(/Boreal Risk Management/)).toBeTruthy();
    expect(css(bar).fontSize).toBe("12px");
  });
});

describe("chrome is actually mounted", () => {
  async function renderApp() {
    stubApi();
    const { container } = render(<App />);
    // the sign-in route at "/" renders inside the chrome
    await screen.findByRole("button", { name: "Send code" });
    return container;
  }

  it("wraps the routed page in the header and footer", async () => {
    const container = await renderApp();
    const header = container.querySelector("header.bi-chrome-header");
    const footer = container.querySelector("footer.bi-chrome-footer");
    const main = container.querySelector("main");
    expect(header).not.toBeNull();
    expect(footer).not.toBeNull();
    expect(main).not.toBeNull();
    // order: header, (banner), main holding the route, footer
    expect(header!.compareDocumentPosition(main!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(main!.compareDocumentPosition(footer!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(within(main as HTMLElement).getByRole("button", { name: "Send code" })).toBeTruthy();
    expect(header!.contains(main)).toBe(false);
    expect(footer!.contains(main)).toBe(false);
  });

  it("pins the footer to the bottom", async () => {
    const container = await renderApp();
    const shell = container.querySelector("header.bi-chrome-header")!.parentElement as HTMLElement;
    expect(shell.style.minHeight).toBe("100vh");
    expect(shell.style.display).toBe("flex");
    expect(shell.style.flexDirection).toBe("column");
    expect((container.querySelector("main") as HTMLElement).style.flexGrow).toBe("1");
    expect(shell.lastElementChild).toBe(container.querySelector("footer"));
  });
});

describe("BI brand and compliance", () => {
  it("carries BI's name, not Boreal Financial's", () => {
    const header = renderHeader();
    expect(within(header).getByText("Boreal Risk Management")).toBeTruthy();
    expect(within(header).getByRole("img").getAttribute("alt")).toBe("Boreal Risk Management");
    const footer = renderFooter();
    expect(within(footer).getAllByText(/Boreal Risk Management/).length).toBeGreaterThan(0);
    expect(header.textContent + footer.textContent).not.toMatch(/Boreal Financial/);
  });

  it("keeps the referral-partner disclosure and Quebec exclusion", () => {
    const footer = renderFooter();
    expect(footer.textContent).toContain("not a licensed");
    expect(footer.textContent).toContain("Not available to Quebec residents");
  });
});
