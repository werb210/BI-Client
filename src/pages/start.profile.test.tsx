// BI_CLIENT_STEP1_PROFILE_v3 - behaviour tests for step 1 (StartPage), the
// phone that the OTP sign-in stores for it, and the route that leads there.
import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { liveJwt } from "@/test-utils/pages2-helpers";

const get = vi.hoisted(() => vi.fn());
const post = vi.hoisted(() => vi.fn());
const signOutWipe = vi.hoisted(() => vi.fn(async (_token: string | null) => undefined));

vi.mock("@/api/client", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  api: { get, post },
}));
vi.mock("@/auth/signOutWipe", () => ({ signOutWipe }));
// The submitted-applicant destination only needs to be recognisable here.
vi.mock("@/pages/HomePage", () => ({ default: () => <h1>Home screen</h1> }));

import StartPage from "@/pages/StartPage";
import AppRouter from "@/router/AppRouter";
import { verifyOtp } from "@/api/otp";
import {
  APPLICANT_PHONE_KEY,
  clearToken,
  expireSession,
  getCachedToken,
  getPhone,
  setPhone,
  setToken,
} from "@/auth/token";

const INDUSTRIES = [{ code: "construction", display_name: "Construction", wants_contract: true }];
let progressState = "todo";

beforeEach(async () => {
  await expireSession();
  localStorage.clear();
  sessionStorage.clear();
  get.mockReset();
  post.mockReset();
  signOutWipe.mockClear();
  progressState = "todo";
  get.mockImplementation(async (path: string) => {
    if (path === "/applicants/industries") return { industries: INDUSTRIES };
    if (path === "/applicants/me/progress") return { progress: { steps: [{ key: "application", state: progressState }] } };
    throw new Error(`unexpected GET ${path}`);
  });
});

function renderStart() {
  return render(
    <MemoryRouter initialEntries={["/start"]}>
      <Routes>
        <Route path="/start" element={<StartPage />} />
        <Route path="/upload" element={<h1>Upload screen</h1>} />
        <Route path="/coverage/:id" element={<h1>Coverage screen</h1>} />
      </Routes>
    </MemoryRouter>,
  );
}

const continueButton = () => screen.getByRole("button", { name: "Continue" });

describe("step 1 collects exactly the fields we do not already have", () => {
  it("asks for business name, applicant name and email", async () => {
    renderStart();
    expect(screen.getByLabelText("Business name")).toHaveProperty("id", "businessName");
    expect(screen.getByLabelText("Your name")).toHaveProperty("id", "applicantName");
    expect(screen.getByLabelText("Email")).toHaveProperty("id", "email");
    await screen.findByRole("option", { name: "Construction" });
  });

  it("shows the OTP phone read-only instead of asking again", async () => {
    await setPhone("+17805551212");
    const { container } = renderStart();
    const shown = await screen.findByText("+17805551212");
    expect(shown.tagName).toBe("DIV");
    expect(screen.getByText("Already confirmed by the code you entered.")).toBeTruthy();
    expect(container.querySelector("#phone")).toBeNull();
    expect(container.querySelector('input[type="tel"]')).toBeNull();
    const values = Array.from(container.querySelectorAll("input")).map((input) => input.value);
    expect(values).not.toContain("+17805551212");
  });

  it("serves both countries", async () => {
    renderStart();
    const country = screen.getByLabelText("Where do you work?") as HTMLSelectElement;
    const options = Array.from(country.options).map((o) => [o.value, o.textContent]);
    expect(options).toEqual([["CA", "Canada"], ["US", "United States"]]);
    fireEvent.change(country, { target: { value: "US" } });
    expect(country.value).toBe("US");
    await screen.findByRole("option", { name: "Construction" });
  });
});

describe("the phone survives the sign-in", () => {
  it("is stored on verify (server phone first, else the typed number in E.164)", async () => {
    post.mockResolvedValueOnce({ token: liveJwt(), phone: "+14165550000", contactId: null });
    await verifyOtp("(780) 555-1212", " 123456 ");
    expect(post).toHaveBeenCalledWith("/applicants/otp/verify", { phone: "+17805551212", code: "123456" });
    expect(await getPhone()).toBe("+14165550000");
    expect(APPLICANT_PHONE_KEY).toBe("boreal_bi_applicant_phone");
    expect(localStorage.getItem("boreal_bi_applicant_phone")).toBe("+14165550000");

    post.mockResolvedValueOnce({ token: liveJwt(), phone: "", contactId: null });
    await verifyOtp("780-555-1212", "123456");
    expect(await getPhone()).toBe("+17805551212");
  });

  it("is cleared with the token on sign-out", async () => {
    const token = liveJwt();
    await setToken(token);
    await setPhone("+17805551212");
    await clearToken();
    expect(signOutWipe).toHaveBeenCalledWith(token);
    expect(getCachedToken()).toBeNull();
    expect(await getPhone()).toBeNull();
    expect(localStorage.getItem(APPLICANT_PHONE_KEY)).toBeNull();
  });
});

describe("sign-in leads into step 1", () => {
  async function signInWithTextCode() {
    post.mockImplementation(async (path: string) => {
      if (path === "/applicants/otp/start") return { ok: true };
      if (path === "/applicants/otp/verify") return { token: liveJwt(), phone: "+17805551212", contactId: null };
      throw new Error(`unexpected POST ${path}`);
    });
    render(
      <MemoryRouter initialEntries={["/"]}>
        <AppRouter />
      </MemoryRouter>,
    );
    fireEvent.change(screen.getByLabelText("Mobile number"), { target: { value: "7805551212" } });
    const code = await screen.findByLabelText("6-digit code");
    fireEvent.change(code, { target: { value: "123456" } });
  }

  it("uses /start as the normal post-OTP fallback", async () => {
    await signInWithTextCode();
    expect(await screen.findByRole("heading", { name: "Tell us who you are" })).toBeTruthy();
    expect(get).toHaveBeenCalledWith("/applicants/me/progress");
    // The step 1 screen shows the phone the sign-in just stored.
    expect(await screen.findByText("+17805551212")).toBeTruthy();
  });

  it("sends an applicant who already submitted to /home instead", async () => {
    progressState = "done";
    await signInWithTextCode();
    expect(await screen.findByRole("heading", { name: "Home screen" })).toBeTruthy();
    expect(screen.queryByRole("heading", { name: "Tell us who you are" })).toBeNull();
  });

  it("keeps step 1 behind the applicant guard", async () => {
    const { unmount } = render(
      <MemoryRouter initialEntries={["/start"]}>
        <AppRouter />
      </MemoryRouter>,
    );
    // No session: the guard sends the visitor to the sign-in page.
    expect(screen.getByLabelText("Mobile number")).toBeTruthy();
    expect(screen.queryByRole("heading", { name: "Tell us who you are" })).toBeNull();
    unmount();

    await setToken(liveJwt());
    render(
      <MemoryRouter initialEntries={["/start"]}>
        <AppRouter />
      </MemoryRouter>,
    );
    expect(await screen.findByRole("heading", { name: "Tell us who you are" })).toBeTruthy();
    expect(screen.getByTestId("account-bar")).toBeTruthy();
  });
});

describe("mobile-first, per locked ruling 23", () => {
  it("uses 56px targets and a sticky CTA", async () => {
    renderStart();
    const cta = continueButton();
    expect(cta.style.minHeight).toBe("56px");
    expect((cta.parentElement as HTMLElement).style.position).toBe("fixed");
    expect((cta.parentElement as HTMLElement).style.bottom).toBe("0px");
    await screen.findByRole("option", { name: "Construction" });
  });

  it("sets input modes so the phone shows the right keyboard", async () => {
    renderStart();
    const email = screen.getByLabelText("Email");
    expect(email.getAttribute("inputmode")).toBe("email");
    expect(email.getAttribute("type")).toBe("email");
    expect(screen.getByLabelText("Business name").getAttribute("autocomplete")).toBe("organization");
    await screen.findByRole("option", { name: "Construction" });
  });

  it("does not let a half-filled form submit", async () => {
    let finish: (value: unknown) => void = () => undefined;
    post.mockImplementation((path: string) => {
      if (path !== "/applicants/profile") throw new Error(`unexpected POST ${path}`);
      return new Promise((resolve) => { finish = resolve; });
    });
    renderStart();
    await screen.findByRole("option", { name: "Construction" });
    expect(continueButton()).toHaveProperty("disabled", true);

    fireEvent.change(screen.getByLabelText("Business name"), { target: { value: "Acme Builders" } });
    fireEvent.change(screen.getByLabelText("Your name"), { target: { value: "Jo Smith" } });
    fireEvent.change(screen.getByLabelText("Email"), { target: { value: "jo@acme" } });
    fireEvent.change(screen.getByLabelText("What industry are you in?"), { target: { value: "construction" } });
    expect(continueButton()).toHaveProperty("disabled", true); // email not valid yet
    fireEvent.click(continueButton());
    expect(post).not.toHaveBeenCalled();

    fireEvent.change(screen.getByLabelText("Email"), { target: { value: "jo@acme.ca" } });
    expect(continueButton()).toHaveProperty("disabled", false);
    fireEvent.click(continueButton());

    // While saving, the button cannot be pressed again.
    const saving = await screen.findByRole("button", { name: "Saving..." });
    expect(saving).toHaveProperty("disabled", true);
    fireEvent.click(saving);
    expect(post).toHaveBeenCalledTimes(1);
    expect(post).toHaveBeenCalledWith("/applicants/profile", expect.objectContaining({
      businessName: "Acme Builders", applicantName: "Jo Smith", email: "jo@acme.ca", country: "CA", industry: "construction",
    }));

    await act(async () => { finish({ applicationId: "app-1", phone: "+17805551212", wantsContract: true }); });
    await waitFor(() => expect(screen.getByRole("heading", { name: "Upload screen" })).toBeTruthy());
  });
});
