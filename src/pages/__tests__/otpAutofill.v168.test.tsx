// BI_CLIENT_OTP_AUTOFILL_v168 - the code field carries the attributes that make
// Chrome / iOS offer the texted code, and keeps only six digits.
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";

const startOtp = vi.hoisted(() => vi.fn(async (_phone: string) => ({ ok: true })));
const verifyOtp = vi.hoisted(() => vi.fn(async (_phone: string, _code: string) => ({ token: "t", phone: "+17805551212", contactId: null })));
const signedInDestination = vi.hoisted(() => vi.fn(async () => "/start"));

vi.mock("@/api/otp", () => ({ startOtp, verifyOtp }));
vi.mock("@/auth/signedInDestination", () => ({ signedInDestination }));

import SignInPage from "@/pages/SignInPage";

beforeEach(() => {
  startOtp.mockClear();
  verifyOtp.mockClear();
  signedInDestination.mockClear();
});

async function codeField(): Promise<HTMLInputElement> {
  render(
    <MemoryRouter>
      <Routes>
        <Route path="/" element={<SignInPage />} />
        <Route path="/start" element={<h1>Step 1</h1>} />
      </Routes>
    </MemoryRouter>,
  );
  fireEvent.change(screen.getByLabelText("Mobile number"), { target: { value: "780 555 1212" } });
  return (await screen.findByLabelText("6-digit code")) as HTMLInputElement;
}

describe("BI_CLIENT_OTP_AUTOFILL_v168", () => {
  it("carries every attribute the working BF-client field has", async () => {
    const field = await codeField();
    expect(startOtp).toHaveBeenCalledWith("780 555 1212");
    expect(field.tagName).toBe("INPUT");
    expect(field.getAttribute("type")).toBe("text");
    expect(field.getAttribute("name")).toBe("otp");
    expect(field.getAttribute("autocomplete")).toBe("one-time-code");
    expect(field.getAttribute("inputmode")).toBe("numeric");
  });

  it("keeps the 6-digit limit", async () => {
    const field = await codeField();
    expect(field.maxLength).toBe(6);
    fireEvent.change(field, { target: { value: "12345678" } });
    expect(field.value).toBe("123456");
    await waitFor(() => expect(verifyOtp).toHaveBeenCalledWith("780 555 1212", "123456"));
    expect(await screen.findByRole("heading", { name: "Step 1" })).toBeTruthy();
  });

  it("strips non-digits so a pasted code cannot carry stray characters", async () => {
    const field = await codeField();
    fireEvent.change(field, { target: { value: "1a2-3" } });
    expect(field.value).toBe("123");
    expect(verifyOtp).not.toHaveBeenCalled();

    fireEvent.change(field, { target: { value: "Code: 654 321." } });
    expect(field.value).toBe("654321");
    // Six clean digits sign in on their own, with exactly those digits.
    await waitFor(() => expect(verifyOtp).toHaveBeenCalledWith("780 555 1212", "654321"));
    await waitFor(() => expect(signedInDestination).toHaveBeenCalled());
    await waitFor(() => expect(screen.queryByLabelText("6-digit code")).toBeNull());
  });
});
