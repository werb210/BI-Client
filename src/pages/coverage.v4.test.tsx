// BI_CLIENT_COVERAGE_v4 - behaviour tests for step 2 (choose coverage).
import { afterEach, beforeEach, describe, expect, expectTypeOf, it } from "vitest";
import { vi } from "vitest";
import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import CoveragePage from "@/pages/CoveragePage";
import UploadContractPage from "@/pages/UploadContractPage";
import type { Product } from "@/api/products";
import { currentLocation, expectGuardedRoute, expectLocation, renderPage, reply, stubApi } from "@/test-utils/pages1-harness";

const product = (code: string, display_name: string, sort_order: number): Product => ({
  code, display_name, sort_order, carrier: "c", coverage_category: "cat", description: `About ${code}.`,
});
// Server order, which is sort_order: PGI leads although it is not first alphabetically.
const PRODUCTS = [
  product("pgi", "Personal Guarantee Insurance", 1),
  product("cgl", "Commercial General Liability", 2),
  product("auto", "Auto Liability", 3),
];

function selection(over: Record<string, unknown> = {}) {
  return { applicationId: "app-123", country: "CA", selected: [], ...over };
}

function stubCoverage(sel: Record<string, unknown> = selection(), products = PRODUCTS, extra = {}) {
  return stubApi({
    "GET /applicants/applications/me/products": sel,
    "GET /applicants/products?country=CA": { country: "CA", products },
    "GET /applicants/products?country=US": { country: "US", products },
    ...extra,
  });
}

const renderCoverage = (id = "me") => renderPage(<CoveragePage />, { routePath: "/coverage/:applicationId", url: `/coverage/${id}` });
const rows = () => screen.getAllByRole("checkbox").filter((el) => el.tagName !== "INPUT");
const row = (name: string) => rows().find((el) => el.textContent?.includes(name))!;
const cta = () => screen.getByRole("button", { name: /Continue with|Select at least one|Saving/ });

beforeEach(() => localStorage.clear());
afterEach(() => vi.unstubAllGlobals());

describe("the no-contract path has an entry point", () => {
  it("the upload page offers it instead of dead-ending", async () => {
    stubApi({});
    renderPage(<UploadContractPage />, { routePath: "/upload", url: "/upload" });
    fireEvent.click(screen.getByRole("button", { name: "I do not have a subcontract yet" }));
    await expectLocation("/coverage/me");
  });
  it("the route exists behind the applicant guard", async () => {
    stubCoverage();
    await expectGuardedRoute("/coverage/me", "What do you need covered?");
  });
});

describe("the list comes from the server, not the client", () => {
  it("does not hardcode a country: asks for the country the application is in", async () => {
    const us = stubCoverage(selection({ country: "US" }));
    const first = renderCoverage();
    await screen.findByText("Personal Guarantee Insurance");
    expect(us.calls.filter((c) => c.path.startsWith("/applicants/products?")).map((c) => c.path))
      .toEqual(["/applicants/products?country=US"]);
    first.unmount();
    vi.unstubAllGlobals();

    const ca = stubCoverage(selection({ country: "CA" }));
    const second = renderCoverage();
    await screen.findByText("Personal Guarantee Insurance");
    expect(ca.calls.filter((c) => c.path.startsWith("/applicants/products?")).map((c) => c.path))
      .toEqual(["/applicants/products?country=CA"]);
    second.unmount();
    vi.unstubAllGlobals();

    // Anything that is not "US" falls back to Canada.
    const other = stubCoverage(selection({ country: undefined }));
    renderCoverage();
    await screen.findByText("Personal Guarantee Insurance");
    expect(other.calls.some((c) => c.path === "/applicants/products?country=CA")).toBe(true);
  });
  it("orders by whatever sort_order the server returns, so PGI leads", async () => {
    stubCoverage();
    renderCoverage();
    await screen.findByText("Personal Guarantee Insurance");
    expect(rows().map((r) => r.textContent?.replace(/About \w+\.$/, ""))).toEqual([
      "Personal Guarantee Insurance", "Commercial General Liability", "Auto Liability",
    ]);
    expectTypeOf<Product["sort_order"]>().toEqualTypeOf<number>();
  });
  it("resolves the literal me to a real application id before saving", async () => {
    const api = stubCoverage(selection({ applicationId: "app 9" }), PRODUCTS, {
      "POST /applicants/applications/app%209/products": selection({ applicationId: "app 9" }),
    });
    renderCoverage("me");
    fireEvent.click(await screen.findByText("Personal Guarantee Insurance"));
    fireEvent.click(cta());
    await waitFor(() => expect(api.to("POST", "/applicants/applications/app%209/products")).toHaveLength(1));
    expect(api.to("POST", "/applicants/applications/me/products")).toHaveLength(0);
    expect(api.to("POST", "/applicants/applications/app%209/products")[0].body).toEqual({ codes: ["pgi"] });
  });
  it("falls back to the route id when the server sends none", async () => {
    const api = stubApi({
      "GET /applicants/applications/app-5/products": selection({ applicationId: "" }),
      "GET /applicants/products?country=CA": { country: "CA", products: PRODUCTS },
      "POST /applicants/applications/app-5/products": selection(),
    });
    renderCoverage("app-5");
    fireEvent.click(await screen.findByText("Auto Liability"));
    fireEvent.click(cta());
    await waitFor(() => expect(api.to("POST", "/applicants/applications/app-5/products")).toHaveLength(1));
    await expectLocation("/questions/app-5");
  });
  it("leads into step 3 once coverage is chosen", async () => {
    stubCoverage(selection({ applicationId: "app 9" }), PRODUCTS, {
      "POST /applicants/applications/app%209/products": selection(),
    });
    renderCoverage("me");
    fireEvent.click(await screen.findByText("Personal Guarantee Insurance"));
    fireEvent.click(cta());
    await expectLocation("/questions/app%209");
  });
  it("stays on the page and says so when the save fails", async () => {
    stubCoverage(selection(), PRODUCTS, {
      "POST /applicants/applications/app-123/products": reply(500, { error: "boom" }),
    });
    renderCoverage("me");
    fireEvent.click(await screen.findByText("Personal Guarantee Insurance"));
    fireEvent.click(cta());
    await screen.findByText("That did not save. Please try again.");
    expect(currentLocation()).toBe("/coverage/me");
  });
});

describe("contract-required lines cannot be unticked", () => {
  const withContract = () => stubCoverage(selection({
    selected: [{ ...PRODUCTS[1], source: "contract" }],
  }));

  it("toggle refuses them and the checkbox is disabled", async () => {
    withContract();
    renderCoverage();
    await screen.findByText("Commercial General Liability");
    const locked = row("Commercial General Liability");
    expect(locked.getAttribute("aria-checked")).toBe("true");
    expect(locked.getAttribute("aria-disabled")).toBe("true");
    expect((within(locked).getByRole("checkbox") as HTMLInputElement).disabled).toBe(true);
    expect(within(locked).getByText("Required by your contract")).toBeTruthy();

    fireEvent.click(locked);
    fireEvent.keyDown(locked, { key: " " });
    fireEvent.keyDown(locked, { key: "Enter" });
    expect(row("Commercial General Liability").getAttribute("aria-checked")).toBe("true");

    // An ordinary line is not marked or locked.
    const free = row("Auto Liability");
    expect(free.getAttribute("aria-disabled")).toBe("false");
    expect(within(free).queryByText("Required by your contract")).toBeNull();
  });
  it("they still count toward the continue total", async () => {
    withContract();
    renderCoverage();
    await screen.findByText("Commercial General Liability");
    expect(cta().textContent).toBe("Continue with 1");
    expect((cta() as HTMLButtonElement).disabled).toBe(false);
    fireEvent.click(row("Personal Guarantee Insurance"));
    expect(cta().textContent).toBe("Continue with 2");
  });
});

describe("mobile-first, per locked ruling 23", () => {
  it("uses a sticky CTA and 44px+ targets", async () => {
    stubCoverage();
    renderCoverage();
    await screen.findByText("Personal Guarantee Insurance");
    expect((cta().parentElement as HTMLElement).style.position).toBe("fixed");
    expect(cta().className).toContain("bi-cta");
    for (const r of rows()) expect(r.style.minHeight).toBe("56px");
  });
  it("rows are keyboard and screen-reader operable, not just clickable divs", async () => {
    stubCoverage();
    renderCoverage();
    await screen.findByText("Personal Guarantee Insurance");
    const pgi = row("Personal Guarantee Insurance");
    expect(pgi.getAttribute("role")).toBe("checkbox");
    expect(pgi.tabIndex).toBe(0);
    expect(pgi.getAttribute("aria-checked")).toBe("false");
    fireEvent.keyDown(pgi, { key: " " });
    expect(row("Personal Guarantee Insurance").getAttribute("aria-checked")).toBe("true");
    fireEvent.keyDown(row("Personal Guarantee Insurance"), { key: "Enter" });
    expect(row("Personal Guarantee Insurance").getAttribute("aria-checked")).toBe("false");
    fireEvent.click(row("Personal Guarantee Insurance"));
    expect(row("Personal Guarantee Insurance").getAttribute("aria-checked")).toBe("true");
    expect((within(row("Personal Guarantee Insurance")).getByRole("checkbox") as HTMLInputElement).checked).toBe(true);
  });
  it("cannot continue with nothing selected, nor twice while saving", async () => {
    let release: () => void = () => undefined;
    const api = stubCoverage(selection(), PRODUCTS, {
      "POST /applicants/applications/app-123/products": () => new Promise((r) => { release = () => r(selection()); }),
    });
    renderCoverage();
    await screen.findByText("Personal Guarantee Insurance");
    expect(cta().textContent).toBe("Select at least one");
    expect((cta() as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(cta());
    expect(api.calls.filter((c) => c.method === "POST")).toHaveLength(0);

    fireEvent.click(row("Personal Guarantee Insurance"));
    fireEvent.click(cta());
    await waitFor(() => expect(cta().textContent).toBe("Saving..."));
    expect((cta() as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(cta());
    release();
    await expectLocation("/questions/app-123");
    expect(api.calls.filter((c) => c.method === "POST")).toHaveLength(1);
  });
});
