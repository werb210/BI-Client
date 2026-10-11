// BI_CLIENT_FIELD_INPUTS_v9 - behaviour tests for the step 3 input types.
import { afterEach, beforeEach, describe, expect, expectTypeOf, it, vi } from "vitest";
import { fireEvent, screen, waitFor } from "@testing-library/react";
import "@/components/chrome/chrome.css";
import QuestionsPage from "@/pages/QuestionsPage";
import type { Question } from "@/api/questions";
import { currentLocation, expectLocation, question, renderPage, stubApi } from "@/test-utils/pages1-harness";

const QUESTIONS = "GET /applicants/applications/app-1/questions";
const ANSWERS = "POST /applicants/applications/app-1/answers";

function stubQuestions(questions: Question[]) {
  return stubApi({
    [QUESTIONS]: { applicationId: "app-1", country: "CA", questions },
    [ANSWERS]: { applicationId: "app-1", country: "CA", questions },
  });
}
const renderQuestions = () => renderPage(<QuestionsPage />, { routePath: "/questions/:applicationId", url: "/questions/app-1" });
const field = (prompt: string) => screen.getByLabelText(prompt) as HTMLInputElement & HTMLSelectElement;
const type = (prompt: string, value: string) => fireEvent.change(field(prompt), { target: { value } });
const cta = () => screen.getByRole("button", { name: /^(Continue|Finish|Saving\.\.\.)$/ });

beforeEach(() => { vi.spyOn(window, "scrollTo").mockImplementation(() => undefined); });
afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });

describe("step 3 renders every input type the bank can hold", () => {
  it("still uses pills for yes/no and agree/disagree", async () => {
    stubQuestions([
      question({ questionKey: "yn", prompt: "Any claims?", inputType: "yes_no" }),
      question({ questionKey: "ad", prompt: "Do you agree?", inputType: "agree_disagree" }),
    ]);
    renderQuestions();
    await screen.findByText("Any claims?");
    // Pills are buttons, not form fields.
    expect(screen.queryByLabelText("Any claims?")).toBeNull();
    expect(screen.queryByLabelText("Do you agree?")).toBeNull();
    const yes = screen.getByRole("button", { name: "Yes" });
    expect(screen.getByRole("button", { name: "No" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Agree" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Disagree" })).toBeTruthy();
    expect(yes.getAttribute("aria-pressed")).toBe("false");
    fireEvent.click(yes);
    expect(screen.getByRole("button", { name: "Yes" }).getAttribute("aria-pressed")).toBe("true");
    expect(screen.getByRole("button", { name: "No" }).getAttribute("aria-pressed")).toBe("false");
  });
  it("renders a select from the options array", async () => {
    stubQuestions([
      question({ questionKey: "entity", prompt: "Entity type", inputType: "select", options: ["Corporation", "Partnership", "Sole proprietor"] }),
      question({ questionKey: "empty", prompt: "No options", inputType: "select", options: null, required: false }),
    ]);
    renderQuestions();
    await screen.findByText("Entity type");
    const select = field("Entity type");
    expect(select.tagName).toBe("SELECT");
    expect(Array.from(select.options).map((o) => [o.value, o.textContent])).toEqual([
      ["", "Choose one\u2026"], ["Corporation", "Corporation"], ["Partnership", "Partnership"], ["Sole proprietor", "Sole proprietor"],
    ]);
    expect(select.value).toBe("");
    fireEvent.change(select, { target: { value: "Partnership" } });
    expect(field("Entity type").value).toBe("Partnership");
    // A null options array still renders, with only the placeholder.
    expect(Array.from(field("No options").options).map((o) => o.value)).toEqual([""]);
  });
  it("renders date and number with the right keyboard", async () => {
    stubQuestions([
      question({ questionKey: "dob", prompt: "Date of birth", inputType: "date" }),
      question({ questionKey: "amt", prompt: "Amount", inputType: "number" }),
      question({ questionKey: "nm", prompt: "Name", inputType: "text" }),
    ]);
    renderQuestions();
    await screen.findByText("Date of birth");
    expect(field("Date of birth").type).toBe("date");
    expect(field("Date of birth").getAttribute("inputmode")).toBeNull();
    expect(field("Amount").type).toBe("number");
    expect(field("Amount").getAttribute("inputmode")).toBe("decimal");
    expect(field("Name").type).toBe("text");
    expect(field("Name").getAttribute("inputmode")).toBeNull();
  });
  it("keeps inputs at 16px so iOS does not zoom the page", async () => {
    // BI_CLIENT_CTA_v23 - ruling 23 still enforced, now from chrome.css where
    // the field geometry lives for every page rather than per page.
    stubQuestions([
      question({ questionKey: "amt", prompt: "Amount", inputType: "number" }),
      question({ questionKey: "entity", prompt: "Entity type", inputType: "select", options: ["A"] }),
      question({ questionKey: "nm", prompt: "Name", inputType: "text" }),
    ]);
    renderQuestions();
    await screen.findByText("Amount");
    for (const prompt of ["Amount", "Entity type", "Name"]) {
      const el = field(prompt);
      expect(el.className).toContain("bi-field");
      const css = getComputedStyle(el);
      expect(css.fontSize).toBe("16px");
      expect(css.minHeight).toBe("56px");
    }
  });
});

describe("the numeric rules from the BI-Website form are enforced", () => {
  it("honours the min and max the bank supplies", async () => {
    stubQuestions([question({ questionKey: "rev", prompt: "Revenue", inputType: "number", minValue: 1000, maxValue: 50000 })]);
    renderQuestions();
    await screen.findByText("Revenue");
    expect(field("Revenue").min).toBe("1000");
    expect(field("Revenue").max).toBe("50000");
    type("Revenue", "500");
    expect(screen.getByText("Must be at least $1,000.")).toBeTruthy();
    type("Revenue", "60000");
    expect(screen.getByText("Cannot be more than $50,000.")).toBeTruthy();
    type("Revenue", "1000");
    expect(screen.queryByText(/Must be at least|Cannot be more than/)).toBeNull();
    type("Revenue", "50000");
    expect(screen.queryByText(/Must be at least|Cannot be more than/)).toBeNull();
  });
  it("keeps cover at or below 80% of the loan", async () => {
    stubQuestions([
      question({ questionKey: "loan_amount", prompt: "Loan amount", inputType: "number", group: "loan" }),
      question({ questionKey: "pgi_limit", prompt: "Cover wanted", inputType: "number", group: "loan" }),
    ]);
    renderQuestions();
    await screen.findByText("Loan amount");
    type("Loan amount", "100000");
    type("Cover wanted", "90000");
    expect(screen.getByText("Cannot be more than 80% of the loan, so $80,000 maximum.")).toBeTruthy();
    type("Cover wanted", "80000");
    expect(screen.queryByText(/80% of the loan/)).toBeNull();
    // The rule follows the loan, not a fixed number.
    type("Loan amount", "50000");
    expect(screen.getByText("Cannot be more than 80% of the loan, so $40,000 maximum.")).toBeTruthy();
  });
  it("treats an out-of-range value as incomplete, not as an answer", async () => {
    const api = stubQuestions([
      question({ questionKey: "rev", prompt: "Revenue", inputType: "number", minValue: 1000, maxValue: null, required: false }),
    ]);
    renderQuestions();
    await screen.findByText("Revenue");
    type("Revenue", "10");
    fireEvent.click(cta());
    expect(screen.getByText("1 question still needs an answer.")).toBeTruthy();
    expect(api.to("POST", "/applicants/applications/app-1/answers")).toHaveLength(0);
    // Fixed, the same (optional) question no longer blocks.
    type("Revenue", "2000");
    fireEvent.click(cta());
    await expectLocation("/review/app-1");
    expect(api.to("POST", "/applicants/applications/app-1/answers")[0].body).toEqual({
      answers: [{ questionKey: "rev", value: "2000", reason: null }],
    });
  });
  it("tells the applicant to correct rather than to answer", async () => {
    stubQuestions([question({ questionKey: "rev", prompt: "Revenue", inputType: "number", minValue: 1000 })]);
    renderQuestions();
    await screen.findByText("Revenue");
    type("Revenue", "10");
    fireEvent.click(cta());
    expect(screen.getByText("Please correct this one.")).toBeTruthy();
    expect(screen.queryByText("Please answer this one.")).toBeNull();
  });
  it("does not accept whitespace as a required answer", async () => {
    const api = stubQuestions([question({ questionKey: "nm", prompt: "Name", inputType: "text" })]);
    renderQuestions();
    await screen.findByText("Name");
    type("Name", "   ");
    fireEvent.click(cta());
    expect(screen.getByText("1 question still needs an answer.")).toBeTruthy();
    expect(api.to("POST", "/applicants/applications/app-1/answers")).toHaveLength(0);
    expect(currentLocation()).toBe("/questions/app-1");
    type("Name", "Ada");
    fireEvent.click(cta());
    await expectLocation("/review/app-1");
  });
});

describe("the new groups are named for a subcontractor, not a carrier", () => {
  it("titles them plainly", async () => {
    stubQuestions([
      question({ questionKey: "a", group: "guarantor", required: false }),
      question({ questionKey: "b", group: "business", required: false }),
      question({ questionKey: "c", group: "loan", required: false }),
    ]);
    renderQuestions();
    expect((await screen.findByRole("heading", { level: 1 })).textContent).toBe("About you");
    fireEvent.click(cta());
    await waitFor(() => expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("About the business"));
    fireEvent.click(cta());
    await waitFor(() => expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("About the loan"));
  });
});

describe("the type carries the new metadata", () => {
  it("includes select and the input metadata", () => {
    expectTypeOf<"select">().toMatchTypeOf<Question["inputType"]>();
    expectTypeOf<Question["options"]>().toEqualTypeOf<string[] | null>();
    expectTypeOf<Question["minValue"]>().toEqualTypeOf<number | null>();
    expectTypeOf<Question["maxValue"]>().toEqualTypeOf<number | null>();
  });
});
