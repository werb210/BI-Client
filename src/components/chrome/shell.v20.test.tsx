// BI_CLIENT_SHELL_v20 - Upload and Requirements take the shell but not the
// outer card: both compose their own panels.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { screen } from "@testing-library/react";
import { renderLoadedPage, stubApi } from "@/test-utils/chrome-pages";
import { backgroundOf, rgb } from "@/test-utils/chrome-dom";

beforeEach(() => { stubApi(); });
afterEach(() => { vi.unstubAllGlobals(); });

const css = (el: Element) => getComputedStyle(el);

describe("both pages use the shell", () => {
  for (const name of ["UploadContractPage", "RequirementsPage"] as const) {
    it(`${name} sits on the mist page ground`, async () => {
      const { container } = await renderLoadedPage(name);
      const page = container.querySelector(".bi-page") as HTMLElement;
      expect(page).not.toBeNull();
      expect(backgroundOf(page)).toBe(rgb("#F5F8FC"));
      const inner = page.querySelector(":scope > .bi-page__inner")!;
      expect(inner).not.toBeNull();
      expect(inner.contains(screen.getByRole("heading", { level: 1 }))).toBe(true);
      expect(css(inner).maxWidth).toBe("620px");
    });

    it(`${name} no longer sets its own width`, async () => {
      const { container } = await renderLoadedPage(name);
      for (const el of Array.from(container.querySelectorAll<HTMLElement>("*"))) {
        expect(el.style.maxWidth).toBe("");
      }
    });

    it(`${name} uses the shell type scale`, async () => {
      await renderLoadedPage(name);
      const h1 = screen.getByRole("heading", { level: 1 });
      expect(h1.getAttribute("style")).toBeNull();
      expect(css(h1).fontSize).toBe("28px");
      expect(css(h1).fontFamily).toMatch(/^"Libre Caslon Text"/);
    });
  }
});

describe("panels are not nested in a card", () => {
  it("Requirements keeps its per-item cards without an outer one", async () => {
    const { container } = await renderLoadedPage("RequirementsPage");
    expect(container.querySelector(".bi-card")).toBeNull();
    const item = screen.getByTestId("requirement-cgl");
    expect(item.textContent).toContain("Commercial General Liability");
    expect(item.style.border).toBe(`1px solid ${rgb("#E4EAF2")}`);
    expect(item.style.borderRadius).toBe("8px");
    expect(backgroundOf(item)).toBe(rgb("#ffffff"));
  });

  it("Upload keeps its dashed dropzone on mist", async () => {
    const { container } = await renderLoadedPage("UploadContractPage");
    expect(container.querySelector(".bi-card")).toBeNull();
    const zone = screen.getByText("Choose a file or drop it here").parentElement as HTMLElement;
    expect(zone.style.borderStyle).toBe("dashed");
    expect(zone.style.borderWidth).toBe("2px");
    expect(backgroundOf(zone)).toBe(rgb("#F5F8FC"));
    expect(zone.contains(screen.getByTestId("contract-file-input"))).toBe(true);
  });
});
