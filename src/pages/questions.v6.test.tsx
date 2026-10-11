// BI_CLIENT_QUESTION_GROUPS_v6 - behaviour tests for step 3: one screen per
// group, completion checked per group, one batch save at the end.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import QuestionsPage from "@/pages/QuestionsPage";
import type { Question } from "@/api/questions";
import { currentLocation, expectGuardedRoute, expectLocation, question, renderPage, stubApi } from "@/test-utils/pages1-harness";

const SAVE = "/applicants/applications/app-1/answers";

function stubQuestions(questions: Question[], id = "app-1") {
  return stubApi({
    [`GET /applicants/applications/${id}/questions`]: { applicationId: "app-1", country: "CA", questions },
    [`POST ${SAVE}`]: { applicationId: "app-1", country: "CA", questions },
  });
}
const renderQuestions = (id = "app-1") => renderPage(<QuestionsPage />, { routePath: "/questions/:applicationId", url: `/questions/${id}` });
const cta = () => screen.getByRole("button", { name: /^(Continue|Finish|Saving\.\.\.)$/ });
const title = () => screen.getByRole("heading", { level: 1 }).textContent;
/** The block that holds a question's prompt. */
const block = (prompt: string) => screen.getByText(prompt).parentElement as HTMLElement;
const pick = (prompt: string, option: string) => fireEvent.click(within(block(prompt)).getByRole("button", { name: option }));

let scrollTo: ReturnType<typeof vi.fn>;
beforeEach(() => {
  scrollTo = vi.fn();
  vi.spyOn(window, "scrollTo").mockImplementation(scrollTo as unknown as typeof window.scrollTo);
});
afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });

const TWO_GROUPS = [
  question({ questionKey: "d1", prompt: "Any bankruptcies?", group: "declarations" }),
  question({ questionKey: "d2", prompt: "Any lawsuits?", group: "declarations" }),
  question({ questionKey: "c1", prompt: "Do you consent to a credit check?", group: "consents", inputType: "agree_disagree" }),
  question({ questionKey: "c2", prompt: "Do you consent to contact?", group: "consents", inputType: "agree_disagree" }),
];

describe("one screen per group, not per question", () => {
  it("pages by group rather than by question index", async () => {
    stubQuestions(TWO_GROUPS);
    renderQuestions();
    await screen.findByText("Step 1 of 2");
    expect(screen.queryByText(/Question \d+ of/)).toBeNull();
    pick("Any bankruptcies?", "No");
    pick("Any lawsuits?", "No");
    fireEvent.click(cta());
    await screen.findByText("Step 2 of 2");
  });
  it("renders every question in the group at once", async () => {
    stubQuestions(TWO_GROUPS);
    renderQuestions();
    await screen.findByText("Any bankruptcies?");
    expect(screen.getByText("Any lawsuits?")).toBeTruthy();
    expect(screen.queryByText("Do you consent to a credit check?")).toBeNull();
  });
  it("groups in the server's order, so ordering stays data", async () => {
    // Consents arrive first, and a later consent question joins its group.
    stubQuestions([
      question({ questionKey: "c1", prompt: "Consent A", group: "consents", inputType: "agree_disagree" }),
      question({ questionKey: "d1", prompt: "Declaration A", group: "declarations" }),
      question({ questionKey: "c2", prompt: "Consent B", group: "consents", inputType: "agree_disagree" }),
    ]);
    renderQuestions();
    await screen.findByText("Consent A");
    expect(title()).toBe("Consents");
    expect(screen.getByText("Consent B")).toBeTruthy();
    expect(screen.queryByText("Declaration A")).toBeNull();
    pick("Consent A", "Agree");
    pick("Consent B", "Agree");
    fireEvent.click(cta());
    await waitFor(() => expect(title()).toBe("A few disclosures"));
    expect(screen.getByText("Declaration A")).toBeTruthy();
  });
  it("titles the disclosure block plainly", async () => {
    stubQuestions(TWO_GROUPS);
    renderQuestions();
    await screen.findByText("Any bankruptcies?");
    expect(title()).toBe("A few disclosures");
    pick("Any bankruptcies?", "No");
    pick("Any lawsuits?", "No");
    fireEvent.click(cta());
    await waitFor(() => expect(title()).toBe("Consents"));
  });
});

describe("completion is checked per group", () => {
  it("blocks Continue until every required question in the group is answered", async () => {
    stubQuestions(TWO_GROUPS);
    renderQuestions();
    await screen.findByText("Any bankruptcies?");
    fireEvent.click(cta());
    expect(screen.getByText("Step 1 of 2")).toBeTruthy();
    expect(screen.getByText("2 questions still needs an answer.")).toBeTruthy();
    pick("Any bankruptcies?", "No");
    fireEvent.click(cta());
    expect(screen.getByText("Step 1 of 2")).toBeTruthy();
    expect(screen.getByText("1 question still needs an answer.")).toBeTruthy();
    pick("Any lawsuits?", "No");
    fireEvent.click(cta());
    await screen.findByText("Step 2 of 2");
  });
  it("lets an unanswered optional question through", async () => {
    stubQuestions([question({ questionKey: "o", prompt: "Optional?", group: "declarations", required: false }),
      question({ questionKey: "c1", prompt: "Consent?", group: "consents" })]);
    renderQuestions();
    await screen.findByText("Optional?");
    fireEvent.click(cta());
    await screen.findByText("Step 2 of 2");
  });
  it("requires an explanation only on the adverse answer", async () => {
    stubQuestions([
      question({ questionKey: "d1", prompt: "Any bankruptcies?", group: "declarations", adverseAnswer: "yes" }),
      question({ questionKey: "c1", prompt: "Consent?", group: "consents" }),
    ]);
    renderQuestions();
    await screen.findByText("Any bankruptcies?");
    pick("Any bankruptcies?", "No");
    expect(screen.queryByPlaceholderText("Please explain\u2026")).toBeNull();
    pick("Any bankruptcies?", "Yes");
    const reason = screen.getByPlaceholderText("Please explain\u2026");
    fireEvent.click(cta());
    expect(screen.getByText("Please add a short explanation.")).toBeTruthy();
    expect(screen.getByText("Step 1 of 2")).toBeTruthy();
    fireEvent.change(reason, { target: { value: "   " } });
    fireEvent.click(cta());
    expect(screen.getByText("Step 1 of 2")).toBeTruthy();
    fireEvent.change(reason, { target: { value: "Discharged in 2015" } });
    fireEvent.click(cta());
    await screen.findByText("Step 2 of 2");
  });
  it("only flags gaps after the applicant tries to move on", async () => {
    stubQuestions(TWO_GROUPS);
    renderQuestions();
    await screen.findByText("Any bankruptcies?");
    expect(screen.queryByText("Please answer this one.")).toBeNull();
    expect(screen.queryByText(/still needs an answer/)).toBeNull();
    fireEvent.click(cta());
    expect(screen.getAllByText("Please answer this one.")).toHaveLength(2);
    pick("Any bankruptcies?", "No");
    expect(screen.getAllByText("Please answer this one.")).toHaveLength(1);
  });
});

describe("conditional questions still apply", () => {
  it("hides a question whose dependency is unmet", async () => {
    stubQuestions([
      question({ questionKey: "has_partner", prompt: "Do you have a partner?", group: "guarantor" }),
      question({ questionKey: "partner_name", prompt: "Partner name", group: "guarantor", inputType: "text", dependsOnKey: "has_partner", dependsOnValue: "yes" }),
    ]);
    renderQuestions();
    await screen.findByText("Do you have a partner?");
    expect(screen.queryByText("Partner name")).toBeNull();
    pick("Do you have a partner?", "Yes");
    expect(screen.getByLabelText("Partner name")).toBeTruthy();
    pick("Do you have a partner?", "No");
    expect(screen.queryByText("Partner name")).toBeNull();
    // A hidden required question does not block.
    fireEvent.click(cta());
    await expectLocation("/review/app-1");
  });
});

describe("answers are saved as one batch at the end", () => {
  it("posts every answered question, not one per tap", async () => {
    const api = stubQuestions([
      question({ questionKey: "d1", prompt: "Any bankruptcies?", group: "declarations", adverseAnswer: "yes" }),
      question({ questionKey: "d2", prompt: "Anything else?", group: "declarations", required: false }),
      question({ questionKey: "c1", prompt: "Consent?", group: "consents", inputType: "agree_disagree" }),
      question({ questionKey: "x", prompt: "Hidden", group: "consents", dependsOnKey: "c1", dependsOnValue: "Disagree", required: false, value: "yes" }),
    ]);
    renderQuestions();
    await screen.findByText("Any bankruptcies?");
    pick("Any bankruptcies?", "Yes");
    fireEvent.change(screen.getByPlaceholderText("Please explain\u2026"), { target: { value: "Old" } });
    fireEvent.click(cta());
    await screen.findByText("Step 2 of 2");
    pick("Consent?", "Agree");
    expect(api.calls.filter((c) => c.method === "POST")).toHaveLength(0);
    expect(cta().textContent).toBe("Finish");
    fireEvent.click(cta());
    await expectLocation("/review/app-1");
    const posts = api.calls.filter((c) => c.method === "POST");
    expect(posts).toHaveLength(1);
    expect(posts[0].path).toBe(SAVE);
    // Unanswered (d2) and hidden (x) questions are left out.
    expect(posts[0].body).toEqual({ answers: [
      { questionKey: "d1", value: "yes", reason: "Old" },
      { questionKey: "c1", value: "Agree", reason: null },
    ] });
  });
  it("saves against the real id the server resolved for me", async () => {
    const api = stubQuestions([question({ questionKey: "c1", prompt: "Consent?", group: "consents" })], "me");
    renderQuestions("me");
    await screen.findByText("Consent?");
    pick("Consent?", "Yes");
    fireEvent.click(cta());
    await expectLocation("/review/app-1");
    expect(api.to("POST", SAVE)).toHaveLength(1);
  });
});

describe("wiring and touch targets", () => {
  it("is routed behind the applicant guard", async () => {
    stubQuestions(TWO_GROUPS);
    await expectGuardedRoute("/questions/app-1", "Any bankruptcies?");
  });
  it("handles agree/disagree separately from yes/no", async () => {
    stubQuestions([
      question({ questionKey: "yn", prompt: "Yes or no?", group: "declarations" }),
      question({ questionKey: "ad", prompt: "Agree or not?", group: "declarations", inputType: "agree_disagree" }),
    ]);
    renderQuestions();
    await screen.findByText("Yes or no?");
    expect(within(block("Agree or not?")).getAllByRole("button").map((b) => b.textContent)).toEqual(["Agree", "Disagree"]);
    expect(within(block("Yes or no?")).getAllByRole("button").map((b) => b.textContent)).toEqual(["Yes", "No"]);
  });
  it("keeps 56px targets and a sticky bar", async () => {
    stubQuestions(TWO_GROUPS);
    renderQuestions();
    await screen.findByText("Any bankruptcies?");
    for (const b of within(block("Any bankruptcies?")).getAllByRole("button")) expect(b.style.minHeight).toBe("56px");
    expect((cta().parentElement as HTMLElement).style.position).toBe("fixed");
    pick("Any bankruptcies?", "No");
    pick("Any lawsuits?", "No");
    fireEvent.click(cta());
    await screen.findByText("Step 2 of 2");
    expect(screen.getByRole("button", { name: "Back" }).style.minHeight).toBe("56px");
  });
  it("scrolls to the top when the group changes", async () => {
    stubQuestions(TWO_GROUPS);
    renderQuestions();
    await screen.findByText("Any bankruptcies?");
    pick("Any bankruptcies?", "No");
    pick("Any lawsuits?", "No");
    expect(scrollTo).not.toHaveBeenCalled();
    fireEvent.click(cta());
    await screen.findByText("Step 2 of 2");
    expect(scrollTo).toHaveBeenCalledTimes(1);
    expect(scrollTo).toHaveBeenLastCalledWith(0, 0);
    fireEvent.click(screen.getByRole("button", { name: "Back" }));
    await screen.findByText("Step 1 of 2");
    expect(scrollTo).toHaveBeenCalledTimes(2);
    expect(scrollTo).toHaveBeenLastCalledWith(0, 0);
    expect(currentLocation()).toBe("/questions/app-1");
  });
});
