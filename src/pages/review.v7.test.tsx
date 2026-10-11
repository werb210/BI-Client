// BI_CLIENT_REVIEW_v7 - behaviour tests for step 4 and the routes into it.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, screen, waitFor } from "@testing-library/react";
import ReviewPage from "@/pages/ReviewPage";
import QuestionsPage from "@/pages/QuestionsPage";
import RequirementsPage from "@/pages/RequirementsPage";
import type { Summary } from "@/api/summary";
import { currentLocation, expectGuardedRoute, expectLocation, question, renderPage, reply, stubApi, type Handler } from "@/test-utils/pages1-harness";

// The route carries "me"; the server answers with the real id, which must be
// what every link back uses.
const SUMMARY = "GET /applicants/applications/me/summary";
const SUBMIT = "POST /applicants/applications/BI%2042/submit";

function summary(over: Partial<Summary> = {}): Summary {
  return {
    applicationId: "BI 42", status: "in_progress", country: "CA",
    businessName: "Acme Framing", applicantName: "Ada Lovelace", email: "ada@acme.co",
    coverages: [
      { code: "cgl", display_name: "Commercial General Liability", source: "contract" },
      { code: "pgi", display_name: "Personal Guarantee Insurance", source: "recommended" },
    ],
    documents: [], answered: 4, outstanding: [], referrals: [], canSubmit: true,
    ...over,
  };
}
function stubReview(first: Handler, extra: Record<string, Handler> = {}) {
  return stubApi({ [SUMMARY]: first, ...extra });
}
const renderReview = () => renderPage(<ReviewPage />, { routePath: "/review/:applicationId", url: "/review/me" });
const text = (el: Element) => (el.textContent ?? "").replace(/\s+/g, " ");
const cardOf = (heading: string | RegExp) => screen.getByText(heading).parentElement as HTMLElement;
const submitButton = () => screen.getByRole("button", { name: /Submit my application|Finish the items above|Submitting/ }) as HTMLButtonElement;

beforeEach(() => { vi.spyOn(window, "scrollTo").mockImplementation(() => undefined); });
afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });

describe("the flow no longer dead-ends", () => {
  it("step 3 leads to review, not the contract requirements page", async () => {
    stubApi({
      "GET /applicants/applications/app%201/questions": { applicationId: "app 1", country: "CA", questions: [question({ questionKey: "c1", prompt: "Consent?", group: "consents" })] },
      "POST /applicants/applications/app%201/answers": { applicationId: "app 1", country: "CA", questions: [] },
    });
    renderPage(<QuestionsPage />, { routePath: "/questions/:applicationId", url: "/questions/app%201" });
    fireEvent.click(await screen.findByRole("button", { name: "Yes" }));
    fireEvent.click(screen.getByRole("button", { name: "Finish" }));
    await expectLocation("/review/app%201");
    expect(currentLocation()).not.toContain("/requirements/");
  });
  it("the requirements page offers a way forward even with no clauses found", async () => {
    stubApi({ "GET /applicants/applications/app%201/requirements": { requirements: [] } });
    const first = renderPage(<RequirementsPage />, { routePath: "/requirements/:applicationId", url: "/requirements/app%201" });
    await screen.findByText("We did not find any insurance clauses");
    fireEvent.click(screen.getByRole("button", { name: "Choose coverage yourself" }));
    await expectLocation("/coverage/app%201");
    first.unmount();

    renderPage(<RequirementsPage />, { routePath: "/requirements/:applicationId", url: "/requirements/app%201" });
    await screen.findByText("We did not find any insurance clauses");
    fireEvent.click(screen.getByRole("button", { name: "Review my application" }));
    await expectLocation("/review/app%201");
  });
  it("review is routed behind the applicant guard", async () => {
    stubReview(summary());
    await expectGuardedRoute("/review/me", "Check this over");
  });
});

describe("review shows what was captured and how to change it", () => {
  it("lists details, coverage, documents and question progress", async () => {
    stubReview(summary({ documents: [{ original_filename: "subcontract.pdf", doc_type: "subcontract" }] }));
    renderReview();
    await screen.findByText("Check this over");
    const details = cardOf("Your details");
    for (const v of ["Acme Framing", "Ada Lovelace", "ada@acme.co", "Canada"]) expect(text(details)).toContain(v);
    expect(text(cardOf("Coverage requested (2)"))).toContain("Personal Guarantee Insurance");
    expect(text(cardOf("Documents"))).toContain("subcontract.pdf");
    expect(text(cardOf("Questions"))).toContain("4 answered");
  });
  it("marks which coverages the contract forced", async () => {
    stubReview(summary());
    renderReview();
    await screen.findByText("Check this over");
    const forced = screen.getByText("Commercial General Liability", { exact: false });
    const chosen = screen.getByText("Personal Guarantee Insurance", { exact: false });
    expect(text(forced)).toContain("\u2014 required by your contract");
    expect(text(chosen)).not.toContain("required by your contract");
  });
  it("offers a route back to each step rather than a dead end", async () => {
    const outstanding = [{ questionKey: "q1", prompt: "Any claims?" }];
    stubReview(summary({ outstanding, canSubmit: false }));
    const goes = async (button: string, to: string) => {
      const view = renderReview();
      fireEvent.click(await screen.findByRole("button", { name: button }));
      await expectLocation(to);
      view.unmount();
    };
    await goes("Change coverage", "/coverage/BI%2042");
    await goes("Upload a document", "/upload");
    await goes("Finish the questions", "/questions/BI%2042");
  });
  it("only offers to finish the questions when some are outstanding", async () => {
    stubReview(summary());
    renderReview();
    await screen.findByText("Check this over");
    expect(screen.queryByRole("button", { name: "Finish the questions" })).toBeNull();
  });
  it("says plainly that no documents is acceptable", async () => {
    stubReview(summary({ documents: [] }));
    renderReview();
    await screen.findByText("Check this over");
    expect(text(cardOf("Documents"))).toContain("None uploaded. That is fine \u2014 we can ask later if we need one.");
  });
});

describe("submission", () => {
  it("is gated on the server's own canSubmit, not a local count", async () => {
    // Nothing outstanding locally, but the server says no: the server wins.
    const api = stubReview(summary({ canSubmit: false, outstanding: [] }));
    const first = renderReview();
    await screen.findByText("Check this over");
    expect(submitButton().textContent).toBe("Finish the items above");
    expect(submitButton().disabled).toBe(true);
    fireEvent.click(submitButton());
    expect(api.calls.filter((c) => c.method === "POST")).toHaveLength(0);
    first.unmount();
    vi.unstubAllGlobals();

    let release: (v: unknown) => void = () => undefined;
    const api2 = stubReview(summary({ canSubmit: true }), {
      [SUBMIT]: () => new Promise((r) => { release = r; }),
    });
    renderReview();
    await screen.findByText("Check this over");
    expect(submitButton().textContent).toBe("Submit my application");
    expect(submitButton().disabled).toBe(false);
    fireEvent.click(submitButton());
    await waitFor(() => expect(submitButton().textContent).toBe("Submitting..."));
    expect(submitButton().disabled).toBe(true);
    fireEvent.click(submitButton());
    release(summary({ status: "ready_for_submission" }));
    await screen.findByText("That's everything we need");
    expect(api2.to("POST", "/applicants/applications/BI%2042/submit")).toHaveLength(1);
  });
  it("re-reads the summary when the server refuses", async () => {
    let reads = 0;
    const api = stubReview(() => {
      reads += 1;
      return reads === 1 ? summary() : summary({ canSubmit: false, outstanding: [{ questionKey: "q9", prompt: "Who signs the guarantee?" }] });
    }, { [SUBMIT]: reply(409, { error: "incomplete" }) });
    renderReview();
    await screen.findByText("Check this over");
    fireEvent.click(submitButton());
    await screen.findByText("We could not submit yet. Please check the items below.");
    await screen.findByText(/Who signs the guarantee\?/);
    expect(api.to("GET", "/applicants/applications/me/summary")).toHaveLength(2);
    expect(submitButton().textContent).toBe("Finish the items above");
  });
  it("shows a confirmation with the reference once submitted", async () => {
    stubReview(summary(), { [SUBMIT]: summary({ status: "ready_for_submission" }) });
    const first = renderReview();
    await screen.findByText("Check this over");
    fireEvent.click(submitButton());
    await screen.findByText("That's everything we need");
    expect(text(cardOf("Reference"))).toContain("BI 42");
    first.unmount();
    vi.unstubAllGlobals();

    // An application that is already in goes straight to the confirmation.
    stubReview(summary({ status: "ready_for_submission" }));
    renderReview();
    await screen.findByText("That's everything we need");
    expect(screen.queryByText("Check this over")).toBeNull();
    expect(screen.queryByRole("button", { name: /Submit/ })).toBeNull();
  });
  it("names the outstanding questions rather than just counting them", async () => {
    const outstanding = Array.from({ length: 7 }, (_, i) => ({ questionKey: `q${i + 1}`, prompt: `Outstanding question ${i + 1}` }));
    stubReview(summary({ outstanding, canSubmit: false }));
    renderReview();
    await screen.findByText("Check this over");
    const card = cardOf("Questions");
    expect(text(card)).toContain("7 still needs an answer:");
    for (let i = 1; i <= 5; i += 1) expect(text(card)).toContain(`Outstanding question ${i}`);
    expect(text(card)).not.toContain("Outstanding question 6");
    expect(text(card)).not.toContain("Outstanding question 7");
  });
});
