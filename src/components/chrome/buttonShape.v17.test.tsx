// BI_CLIENT_DESIGN_v17 - controls should be the same size and shape as the
// ones on bf-client and bi-website.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { screen } from "@testing-library/react";
import { controls, PAGE_NAMES, renderLoadedPage, stubApi } from "@/test-utils/chrome-pages";

beforeEach(() => { stubApi(); });
afterEach(() => { vi.unstubAllGlobals(); });

const radius = (el: Element) => getComputedStyle(el).borderRadius;
const minHeight = (name: string) => getComputedStyle(screen.getByRole("button", { name })).minHeight;

describe("controls share one shape", () => {
  for (const name of PAGE_NAMES) {
    it(`${name}: every rounded control uses the single 8px radius`, async () => {
      const { container } = await renderLoadedPage(name);
      const rounded = controls(container).filter((el) => radius(el) !== "" && radius(el) !== "0px");
      expect(rounded.length).toBeGreaterThan(0);
      for (const el of rounded) {
        expect(`${el.tagName} "${el.textContent}" ${radius(el)}`).toBe(`${el.tagName} "${el.textContent}" 8px`);
      }
    });
  }

  it("keeps the locked mobile touch targets: 56px primary", async () => {
    // ruling 23: 56px primary, 44px floor. Deliberate, not drift.
    await renderLoadedPage("CoveragePage");
    expect(minHeight("Continue with 1")).toBe("56px");
  });

  it("keeps the 56px primary on the two-button rows", async () => {
    await renderLoadedPage("QuestionsPage");
    expect(minHeight("Continue")).toBe("56px");
  });

  it("keeps the 44px floor on the secondary links", async () => {
    await renderLoadedPage("CoveragePage");
    expect(minHeight("upload it and we will read it")).toBe("44px");
  });

  it("keeps the 44px floor on Review's secondary actions", async () => {
    await renderLoadedPage("ReviewPage");
    expect(minHeight("Change coverage")).toBe("44px");
    expect(minHeight("Upload a document")).toBe("44px");
    expect(minHeight("Submit my application")).toBe("56px");
  });

  it("keeps the 44px floor on Upload's no-contract link", async () => {
    await renderLoadedPage("UploadContractPage");
    expect(minHeight("I do not have a subcontract yet")).toBe("44px");
  });

  it("keeps the 56px primary on the profile step", async () => {
    await renderLoadedPage("StartPage");
    expect(minHeight("Continue")).toBe("56px");
  });
});

describe("motion matches the other properties", () => {
  it("every button gets the shared transition", async () => {
    const { container } = await renderLoadedPage("HomePage");
    const buttons = Array.from(container.querySelectorAll("button"));
    expect(buttons.length).toBeGreaterThan(0);
    for (const b of buttons) {
      const transition = getComputedStyle(b).transition.replace(/\s+/g, " ");
      expect(transition).toContain("transform 60ms ease");
      expect(transition).toContain("background-color 120ms ease");
    }
  });

  it("the primary CTA keeps the same timing", async () => {
    await renderLoadedPage("ReviewPage");
    const transition = getComputedStyle(screen.getByRole("button", { name: "Submit my application" })).transition.replace(/\s+/g, " ");
    expect(transition).toContain("transform 60ms ease");
    expect(transition).toContain("background-color 120ms ease");
  });
});
