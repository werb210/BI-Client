// BI_CLIENT_v791 - an answer of only spaces is no answer: it gets the
// empty-answer message, not the "explain" one.
import { afterEach, describe, expect, it, vi } from "vitest";
import { fireEvent, screen } from "@testing-library/react";
import QuestionsPage from "@/pages/QuestionsPage";
import { question, renderPage, stubApi } from "@/test-utils/pages1-harness";

afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });

describe("a required text answer of only spaces", () => {
  it("asks for an answer rather than an explanation", async () => {
    vi.spyOn(window, "scrollTo").mockImplementation(() => undefined);
    const questions = [question({ questionKey: "biz", prompt: "Business name", group: "general", inputType: "text" })];
    stubApi({
      "GET /applicants/applications/app-1/questions": { applicationId: "app-1", country: "CA", questions },
      "POST /applicants/applications/app-1/answers": { applicationId: "app-1", country: "CA", questions },
    });
    renderPage(<QuestionsPage />, { routePath: "/questions/:applicationId", url: "/questions/app-1" });
    fireEvent.change(await screen.findByRole("textbox", { name: "Business name" }), { target: { value: "   " } });
    fireEvent.click(screen.getByRole("button", { name: /^(Continue|Finish)$/ }));
    expect(await screen.findByText("Please answer this one.")).toBeTruthy();
    expect(screen.queryByText("Please add a short explanation.")).toBeNull();
  });
});
