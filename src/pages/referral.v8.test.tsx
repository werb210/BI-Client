// BI_CLIENT_REFERRAL_v8 - behaviour tests: a coverage we cannot place is
// flagged before it is confirmed, and review keeps referrals apart.
import { afterEach, beforeEach, describe, expect, expectTypeOf, it, vi } from "vitest";
import { fireEvent, screen, waitFor } from "@testing-library/react";
import RequirementsPage from "@/pages/RequirementsPage";
import ReviewPage from "@/pages/ReviewPage";
import { getSummary, type Referral, type Summary } from "@/api/summary";
import type { Requirement } from "@/api/contract";
import { renderPage, reply, stubApi, type Handler } from "@/test-utils/pages1-harness";

const BASE = "/applicants/applications/app-1";

function requirement(over: Partial<Requirement> & { id: string; coverageCode: string; displayName: string }): Requirement {
  return { extractedLimit: 2000000, limitBasis: "per occurrence", clauseText: "The subcontractor shall carry insurance.", confidence: 0.9, confirmedByClient: null, ...over };
}
const UNPLACEABLE = requirement({ id: "r1", coverageCode: "marine", displayName: "Marine Cargo", available: false });
const PLACEABLE = requirement({ id: "r2", coverageCode: "cgl", displayName: "Commercial General Liability", available: true });

function stubRequirements(requirements: Requirement[], selection: Handler, extra: Record<string, Handler> = {}) {
  return stubApi({
    [`GET ${BASE}/requirements`]: { requirements },
    [`GET ${BASE}/products`]: selection,
    [`POST ${BASE}/requirements/r1/confirm`]: { ok: true },
    [`POST ${BASE}/requirements/r2/confirm`]: { ok: true },
    ...extra,
  });
}
const renderRequirements = () => renderPage(<RequirementsPage />, { routePath: "/requirements/:applicationId", url: "/requirements/app-1" });
const card = (code: string) => screen.getByTestId(`requirement-${code}`);
const text = (el: Element) => (el.textContent ?? "").replace(/\s+/g, " ");

function summary(over: Partial<Summary> = {}): Summary {
  return {
    applicationId: "app-1", status: "in_progress", country: "CA", businessName: "Acme", applicantName: "Ada", email: "a@b.co",
    coverages: [{ code: "cgl", display_name: "Commercial General Liability", source: "contract" }],
    documents: [], answered: 3, outstanding: [], canSubmit: true,
    referrals: [
      { coverage_code: "marine", display_name: "Marine Cargo", requested_limit: "1000000", status: "pending" },
      { coverage_code: "aviation", display_name: "Aviation Liability", requested_limit: null, status: "pending" },
    ],
    ...over,
  };
}
const renderReview = () => renderPage(<ReviewPage />, { routePath: "/review/:applicationId", url: "/review/app-1" });
const headingCard = (heading: string | RegExp) => screen.getByText(heading).parentElement as HTMLElement;

beforeEach(() => { vi.spyOn(window, "scrollTo").mockImplementation(() => undefined); });
afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });

describe("an unplaceable requirement says so before it is confirmed", () => {
  it("shows a notice naming the country", async () => {
    stubRequirements([UNPLACEABLE, PLACEABLE], { applicationId: "app-1", country: "CA", selected: [] });
    renderRequirements();
    await screen.findByText("Marine Cargo");
    await waitFor(() => expect(text(card("marine"))).toContain("We cannot place this one in Canada ourselves."));
    expect(text(card("cgl"))).not.toContain("We cannot place this one");
  });

  it("resolves the real country rather than guessing", async () => {
    stubRequirements([UNPLACEABLE], { applicationId: "app-1", country: "US", selected: [] });
    const us = renderRequirements();
    await waitFor(() => expect(text(card("marine"))).toContain("We cannot place this one in the United States ourselves."));
    us.unmount();
    vi.unstubAllGlobals();

    // Without the selection the notice says "your country", not a guess.
    stubRequirements([UNPLACEABLE], reply(500, { error: "boom" }));
    renderRequirements();
    await waitFor(() => expect(text(card("marine"))).toContain("We cannot place this one in your country ourselves."));
    expect(text(card("marine"))).not.toMatch(/Canada|United States/);
  });

  it("does not claim it was simply Confirmed afterwards", async () => {
    stubRequirements([UNPLACEABLE, PLACEABLE], { applicationId: "app-1", country: "CA", selected: [] });
    renderRequirements();
    await screen.findByText("Marine Cargo");
    fireEvent.click(screen.getByTestId("confirm-marine"));
    await waitFor(() => expect(text(card("marine"))).toContain("Confirmed. We will refer this one out and come back to you."));
    fireEvent.click(screen.getByTestId("confirm-cgl"));
    await waitFor(() => expect(screen.queryByTestId("confirm-cgl")).toBeNull());
    expect(text(card("cgl"))).toContain("Confirmed");
    expect(text(card("cgl"))).not.toContain("refer this one out");
  });

  it("still lets the applicant confirm, because that is the demand signal", async () => {
    const api = stubRequirements([UNPLACEABLE], { applicationId: "app-1", country: "CA", selected: [] });
    renderRequirements();
    await screen.findByText("Marine Cargo");
    const yes = screen.getByTestId("confirm-marine") as HTMLButtonElement;
    expect(yes.textContent).toBe("Yes, that is right");
    expect(yes.disabled).toBe(false);
    fireEvent.click(yes);
    await waitFor(() => expect(api.to("POST", `${BASE}/requirements/r1/confirm`)).toHaveLength(1));
    expect(api.to("POST", `${BASE}/requirements/r1/confirm`)[0].body).toEqual({ confirmed: true });
  });
});

describe("review separates referrals from quoted coverage", () => {
  it("gives them their own block, not the coverage list", async () => {
    stubApi({ [`GET ${BASE}/summary`]: summary() });
    renderReview();
    const referrals = (await screen.findByText("Being referred out (2)")).parentElement as HTMLElement;
    expect(text(referrals)).toContain("Marine Cargo");
    expect(text(referrals)).toContain("Aviation Liability");
    expect(text(referrals)).not.toContain("Commercial General Liability");
    const coverage = headingCard("Coverage requested (1)");
    expect(text(coverage)).toContain("Commercial General Liability");
    expect(text(coverage)).not.toContain("Marine Cargo");
    expect(text(coverage)).not.toContain("Aviation Liability");
  });

  it("has no referral block when there are none", async () => {
    stubApi({ [`GET ${BASE}/summary`]: summary({ referrals: [] }) });
    renderReview();
    await screen.findByText("Check this over");
    expect(screen.queryByText(/Being referred out/)).toBeNull();
  });

  it("explains what happens next", async () => {
    stubApi({ [`GET ${BASE}/summary`]: summary() });
    renderReview();
    const referrals = (await screen.findByText("Being referred out (2)")).parentElement as HTMLElement;
    expect(text(referrals)).toContain("Our team will find you a market and come back to you.");
    expect(text(referrals)).toContain("we do not place them in Canada ourselves");
  });

  it("repeats them on the confirmation screen", async () => {
    stubApi({
      [`GET ${BASE}/summary`]: summary(),
      [`POST ${BASE}/submit`]: summary({ status: "ready_for_submission" }),
    });
    renderReview();
    await screen.findByText("Being referred out (2)");
    fireEvent.click(screen.getByRole("button", { name: "Submit my application" }));
    await screen.findByText("That's everything we need");
    const referred = screen.getByText("Being referred out");
    const done = referred.parentElement as HTMLElement;
    expect(text(done)).toContain("Marine Cargo");
    expect(text(done)).toContain("Aviation Liability");
  });

  it("does not block submission", async () => {
    const api = stubApi({
      [`GET ${BASE}/summary`]: summary(),
      [`POST ${BASE}/submit`]: summary({ status: "ready_for_submission" }),
    });
    renderReview();
    await screen.findByText("Being referred out (2)");
    const submit = screen.getByRole("button", { name: "Submit my application" }) as HTMLButtonElement;
    expect(submit.disabled).toBe(false);
    fireEvent.click(submit);
    await waitFor(() => expect(api.to("POST", `${BASE}/submit`)).toHaveLength(1));
  });
});

describe("types carry the new fields", () => {
  it("Requirement has availability", () => {
    expectTypeOf<Requirement["available"]>().toEqualTypeOf<boolean | undefined>();
  });

  it("Summary has referrals", async () => {
    expectTypeOf<Summary["referrals"]>().toEqualTypeOf<Referral[]>();
    expectTypeOf<Referral["requested_limit"]>().toEqualTypeOf<string | null>();
    // The api hands the server's referrals through untouched.
    stubApi({ [`GET ${BASE}/summary`]: summary() });
    const s = await getSummary("app-1");
    expect(s.referrals.map((r) => r.requested_limit)).toEqual(["1000000", null]);
  });
});
