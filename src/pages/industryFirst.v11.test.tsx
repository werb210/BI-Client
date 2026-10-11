// BI_CLIENT_INDUSTRY_v11 - behaviour tests: industry is asked first, decides
// the path, can be preselected by an entry link, and narrows the coverage list.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, screen, waitFor } from "@testing-library/react";
import StartPage from "@/pages/StartPage";
import CoveragePage from "@/pages/CoveragePage";
import { captureEntryParams, getEntryIndustry, getEntrySource, setChosenIndustry } from "@/entry/entryContext";
import { expectLocation, renderPage, stubApi, type Handler } from "@/test-utils/pages1-harness";

const INDUSTRIES = {
  industries: [
    { code: "construction", display_name: "Construction", wants_contract: true },
    { code: "retail", display_name: "Retail", wants_contract: false },
  ],
};

function stubStart(profile: Handler = { applicationId: "app-1", phone: "+15555550100", wantsContract: false }) {
  return stubApi({
    "GET /applicants/industries": INDUSTRIES,
    "POST /applicants/profile": profile,
  });
}
const renderStart = () => renderPage(<StartPage />, { routePath: "/start", url: "/start" });
const industrySelect = () => screen.getByTestId("industry-select") as HTMLSelectElement;
const cta = () => screen.getByRole("button", { name: /^(Continue|Saving\.\.\.)$/ }) as HTMLButtonElement;
async function industriesLoaded() {
  await waitFor(() => expect(industrySelect().options.length).toBe(3));
}
function fillDetails() {
  fireEvent.change(screen.getByLabelText("Business name"), { target: { value: "Acme Framing" } });
  fireEvent.change(screen.getByLabelText("Your name"), { target: { value: "Ada Lovelace" } });
  fireEvent.change(screen.getByLabelText("Email"), { target: { value: "ada@acme.co" } });
}

beforeEach(() => localStorage.clear());
afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });

describe("industry is asked first and decides the path", () => {
  it("renders the dropdown above every other field", async () => {
    stubStart();
    const { container } = renderStart();
    await industriesLoaded();
    const controls = Array.from(container.querySelectorAll("input, select, textarea"));
    expect(controls[0]).toBe(industrySelect());
    const business = screen.getByLabelText("Business name");
    expect(industrySelect().compareDocumentPosition(business) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });
  it("has no default", async () => {
    stubStart();
    renderStart();
    await industriesLoaded();
    expect(industrySelect().value).toBe("");
    expect(industrySelect().options[0].value).toBe("");
    expect(industrySelect().options[0].textContent).toBe("Choose your industry");
    fillDetails();
    expect(cta().disabled).toBe(true);
    fireEvent.change(industrySelect(), { target: { value: "retail" } });
    expect(cta().disabled).toBe(false);
    // Going back to the empty choice blocks Continue again.
    fireEvent.change(industrySelect(), { target: { value: "" } });
    expect(cta().disabled).toBe(true);
  });
  it("branches on the server's wantsContract", async () => {
    stubStart({ applicationId: "app-1", phone: "+1", industry: "construction", wantsContract: true });
    const first = renderStart();
    await industriesLoaded();
    fireEvent.change(industrySelect(), { target: { value: "construction" } });
    fillDetails();
    fireEvent.click(cta());
    await expectLocation("/upload");
    first.unmount();
    vi.unstubAllGlobals();

    stubStart({ applicationId: "app-1", phone: "+1", industry: "retail", wantsContract: false });
    renderStart();
    await industriesLoaded();
    fireEvent.change(industrySelect(), { target: { value: "retail" } });
    fillDetails();
    fireEvent.click(cta());
    await expectLocation("/coverage/me");
  });
  it("loads industries from the server", async () => {
    const api = stubStart();
    renderStart();
    await industriesLoaded();
    expect(api.to("GET", "/applicants/industries")).toHaveLength(1);
    expect(Array.from(industrySelect().options).map((o) => [o.value, o.textContent])).toEqual([
      ["", "Choose your industry"], ["construction", "Construction"], ["retail", "Retail"],
    ]);
  });
});

describe("entry link", () => {
  it("captures at boot", async () => {
    window.history.replaceState(null, "", "/?industry=Roofing&src=Newsletter");
    try {
      vi.resetModules();
      await import("@/App");
      expect(getEntryIndustry()).toBe("roofing");
      expect(getEntrySource()).toBe("newsletter");
    } finally {
      window.history.replaceState(null, "", "/");
    }
  });
  it("reads sanitized params", () => {
    captureEntryParams("?industry=Road%20Works!%3Cb%3E&src=News_letter-2%22;drop");
    expect(getEntryIndustry()).toBe("roadworksb");
    expect(getEntrySource()).toBe("news_letter-2drop");
    localStorage.clear();
    captureEntryParams("?foo=bar");
    expect(getEntryIndustry()).toBe("");
    expect(getEntrySource()).toBe("");
  });
  it("preselects and passes source", async () => {
    // A saved draft industry loses to the entry link.
    localStorage.setItem("boreal_bi_draft_profile", JSON.stringify({ industry: "retail" }));
    captureEntryParams("?industry=construction&src=partner");
    const api = stubStart({ applicationId: "app-1", phone: "+1", industry: "construction", wantsContract: true });
    const first = renderStart();
    await industriesLoaded();
    expect(industrySelect().value).toBe("construction");
    fillDetails();
    fireEvent.click(cta());
    await expectLocation("/upload");
    expect(api.to("POST", "/applicants/profile")[0].body).toMatchObject({ industry: "construction", src: "partner" });
    first.unmount();
    vi.unstubAllGlobals();

    // No entry source: none is sent.
    localStorage.clear();
    const api2 = stubStart();
    renderStart();
    await industriesLoaded();
    expect(industrySelect().value).toBe("");
    fireEvent.change(industrySelect(), { target: { value: "retail" } });
    fillDetails();
    fireEvent.click(cta());
    await expectLocation("/coverage/me");
    expect(api2.to("POST", "/applicants/profile")[0].body).not.toHaveProperty("src");
  });
});

describe("industry coverage", () => {
  const selection = { applicationId: "app-1", country: "CA", selected: [] };
  const products = [{ code: "pgi", display_name: "Personal Guarantee Insurance", carrier: "c", coverage_category: "x", description: "", sort_order: 1 }];
  const renderCoverage = () => renderPage(<CoveragePage />, { routePath: "/coverage/:applicationId", url: "/coverage/me" });

  it("queries industry", async () => {
    setChosenIndustry("roofing");
    const api = stubApi({
      "GET /applicants/applications/me/products": selection,
      "GET /applicants/products?country=CA&industry=roofing": { country: "CA", industry: "roofing", products },
    });
    const first = renderCoverage();
    await screen.findByText("Personal Guarantee Insurance");
    expect(api.calls.filter((c) => c.path.startsWith("/applicants/products?")).map((c) => c.path))
      .toEqual(["/applicants/products?country=CA&industry=roofing"]);
    first.unmount();
    vi.unstubAllGlobals();

    // No industry known: the parameter is left off rather than sent empty.
    localStorage.clear();
    const api2 = stubApi({
      "GET /applicants/applications/me/products": selection,
      "GET /applicants/products?country=CA": { country: "CA", products },
    });
    renderCoverage();
    await screen.findByText("Personal Guarantee Insurance");
    expect(api2.calls.filter((c) => c.path.startsWith("/applicants/products?")).map((c) => c.path))
      .toEqual(["/applicants/products?country=CA"]);
  });
  it("the industry chosen on step 1 is the one used", async () => {
    stubStart({ applicationId: "app-1", phone: "+1", industry: "Retail", wantsContract: false });
    renderStart();
    await industriesLoaded();
    fireEvent.change(industrySelect(), { target: { value: "retail" } });
    fillDetails();
    fireEvent.click(cta());
    await expectLocation("/coverage/me");
    vi.unstubAllGlobals();
    const api = stubApi({
      "GET /applicants/applications/me/products": selection,
      "GET /applicants/products?country=CA&industry=retail": { country: "CA", products },
    });
    renderCoverage();
    await waitFor(() => expect(api.calls.some((c) => c.path === "/applicants/products?country=CA&industry=retail")).toBe(true));
  });
  it("shows category contract upload", async () => {
    stubApi({
      "GET /applicants/applications/me/products": selection,
      "GET /applicants/products?country=CA": { country: "CA", kind: "categories", products },
    });
    const first = renderCoverage();
    await screen.findByText("Personal Guarantee Insurance");
    fireEvent.click(screen.getByTestId("upload-other-contract"));
    await expectLocation("/upload");
    first.unmount();
    vi.unstubAllGlobals();

    stubApi({
      "GET /applicants/applications/me/products": selection,
      "GET /applicants/products?country=CA": { country: "CA", kind: "products", products },
    });
    renderCoverage();
    await screen.findByText("Personal Guarantee Insurance");
    expect(screen.queryByTestId("upload-other-contract")).toBeNull();
  });
});
