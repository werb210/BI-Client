// BI_CLIENT_FLOW_v12 - behaviour tests for the v12 flow fixes.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ReactElement } from "react";
import { fireEvent, screen, waitFor } from "@testing-library/react";
import SignInPage from "@/pages/SignInPage";
import StartPage from "@/pages/StartPage";
import UploadContractPage from "@/pages/UploadContractPage";
import RequirementsPage from "@/pages/RequirementsPage";
import CoveragePage from "@/pages/CoveragePage";
import QuestionsPage from "@/pages/QuestionsPage";
import ReviewPage from "@/pages/ReviewPage";
import { currentLocation, expectLocation, question, renderApp, renderPage, signIn, stubApi } from "@/test-utils/pages1-harness";

const INDUSTRIES = { industries: [{ code: "retail", display_name: "Retail", wants_contract: false }] };

beforeEach(async () => {
  localStorage.clear();
  await signIn(false);
  vi.spyOn(window, "scrollTo").mockImplementation(() => undefined);
});
afterEach(async () => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  await signIn(false);
});

describe("v12 flow fixes", () => {
  it("automatically submits complete OTP values", async () => {
    const api = stubApi({
      "POST /applicants/otp/start": { ok: true },
      "POST /applicants/otp/verify": { token: "otp-token", phone: "+15551234567", contactId: null },
      "GET /applicants/me/progress": { progress: null },
    });
    renderPage(<SignInPage />, { routePath: "/", url: "/" });
    const phone = screen.getByLabelText("Mobile number");
    // Short numbers are not sent; a complete one is sent without pressing anything.
    fireEvent.change(phone, { target: { value: "555123" } });
    expect(api.to("POST", "/applicants/otp/start")).toHaveLength(0);
    fireEvent.change(phone, { target: { value: "(555) 123-4567" } });
    const code = await screen.findByLabelText("6-digit code");
    expect(api.to("POST", "/applicants/otp/start")).toHaveLength(1);
    expect(api.to("POST", "/applicants/otp/start")[0].body).toEqual({ phone: "+15551234567" });

    fireEvent.change(code, { target: { value: "12345" } });
    expect(api.to("POST", "/applicants/otp/verify")).toHaveLength(0);
    fireEvent.change(code, { target: { value: "123456" } });
    await expectLocation("/start");
    // One send per number and one check per code, never a repeat of either.
    expect(api.to("POST", "/applicants/otp/start")).toHaveLength(1);
    expect(api.to("POST", "/applicants/otp/verify")).toHaveLength(1);
    expect(api.to("POST", "/applicants/otp/verify")[0].body).toEqual({ phone: "+15551234567", code: "123456" });
  });

  it("persists the profile draft", async () => {
    stubApi({
      "GET /applicants/industries": INDUSTRIES,
      "POST /applicants/profile": { applicationId: "app-1", phone: "+1", wantsContract: false },
    });
    const first = renderPage(<StartPage />, { routePath: "/start", url: "/start" });
    await waitFor(() => expect((screen.getByTestId("industry-select") as HTMLSelectElement).options.length).toBe(2));
    fireEvent.change(screen.getByTestId("industry-select"), { target: { value: "retail" } });
    fireEvent.change(screen.getByLabelText("Business name"), { target: { value: "Acme Framing" } });
    fireEvent.change(screen.getByLabelText("Your name"), { target: { value: "Ada Lovelace" } });
    fireEvent.change(screen.getByLabelText("Where do you work?"), { target: { value: "US" } });
    first.unmount();

    // Leaving and coming back keeps what was typed.
    const second = renderPage(<StartPage />, { routePath: "/start", url: "/start" });
    await waitFor(() => expect((screen.getByTestId("industry-select") as HTMLSelectElement).options.length).toBe(2));
    expect((screen.getByLabelText("Business name") as HTMLInputElement).value).toBe("Acme Framing");
    expect((screen.getByLabelText("Your name") as HTMLInputElement).value).toBe("Ada Lovelace");
    expect((screen.getByLabelText("Where do you work?") as HTMLSelectElement).value).toBe("US");
    expect((screen.getByTestId("industry-select") as HTMLSelectElement).value).toBe("retail");

    // Once saved, the draft is gone.
    fireEvent.change(screen.getByLabelText("Email"), { target: { value: "ada@acme.co" } });
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));
    await expectLocation("/coverage/me");
    second.unmount();
    renderPage(<StartPage />, { routePath: "/start", url: "/start" });
    await waitFor(() => expect((screen.getByTestId("industry-select") as HTMLSelectElement).options.length).toBe(2));
    expect((screen.getByTestId("industry-select") as HTMLSelectElement).value).toBe("");
    expect((screen.getByLabelText("Business name") as HTMLInputElement).value).toBe("");
    expect((screen.getByLabelText("Email") as HTMLInputElement).value).toBe("");
  });

  describe("provides back navigation", () => {
    const sel = { applicationId: "app-1", country: "CA", selected: [] };
    const cases: Array<{ name: string; page: ReactElement; routePath: string; url: string; ready: string; back: string }> = [
      { name: "StartPage", page: <StartPage />, routePath: "/start", url: "/start", ready: "Tell us who you are", back: "/" },
      { name: "UploadContractPage", page: <UploadContractPage />, routePath: "/upload", url: "/upload", ready: "Upload your subcontract", back: "/start" },
      { name: "RequirementsPage", page: <RequirementsPage />, routePath: "/requirements/:applicationId", url: "/requirements/app-1", ready: "What your contract asks for", back: "/upload" },
      { name: "CoveragePage", page: <CoveragePage />, routePath: "/coverage/:applicationId", url: "/coverage/app-1", ready: "What do you need covered?", back: "/prev" },
      { name: "QuestionsPage", page: <QuestionsPage />, routePath: "/questions/:applicationId", url: "/questions/app-1", ready: "Step 1 of 1", back: "/prev" },
      { name: "ReviewPage", page: <ReviewPage />, routePath: "/review/:applicationId", url: "/review/app-1", ready: "Check this over", back: "/prev" },
    ];
    for (const c of cases) {
      it(`${c.name} has a back button that leaves the page`, async () => {
        stubApi({
          "GET /applicants/industries": INDUSTRIES,
          "GET /applicants/applications/app-1/requirements": { requirements: [] },
          "GET /applicants/applications/app-1/products": sel,
          "GET /applicants/products?country=CA": { country: "CA", products: [] },
          "GET /applicants/applications/app-1/questions": { applicationId: "app-1", country: "CA", questions: [question({ questionKey: "q1" })] },
          "GET /applicants/applications/app-1/summary": {
            applicationId: "app-1", status: "in_progress", country: "CA", businessName: null, applicantName: null, email: null,
            coverages: [], documents: [], answered: 0, outstanding: [], referrals: [], canSubmit: false,
          },
        });
        renderPage(c.page, { routePath: c.routePath, url: c.url, history: ["/prev"] });
        await screen.findByText(c.ready);
        fireEvent.click(screen.getByTestId("back-button"));
        await expectLocation(c.back);
      });
    }
  });

  it("removes the schedule detour", async () => {
    stubApi({});
    await signIn(true);
    const view = renderApp("/schedule/app-1");
    // No route answers it: the catch-all sends the applicant to "/".
    await expectLocation("/");
    expect(screen.queryByTestId("account-bar")).toBeNull();
    view.unmount();
    // The same signed-in applicant does reach a real step, so the bounce is not the guard.
    stubApi({
      "GET /applicants/applications/app-1/summary": {
        applicationId: "app-1", status: "in_progress", country: "CA", businessName: null, applicantName: null, email: null,
        coverages: [], documents: [], answered: 0, outstanding: [], referrals: [], canSubmit: false,
      },
    });
    renderApp("/review/app-1");
    await screen.findByText("Check this over");
    expect(currentLocation()).toBe("/review/app-1");
  });
});
