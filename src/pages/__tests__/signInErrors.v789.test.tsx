// BI_CLIENT_v789 - sign-in shows the server's words, or a specific sentence per code.
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { ApiError } from "@/api/client";

const startOtp = vi.fn();
vi.mock("@/api/otp", () => ({ startOtp: (...a: unknown[]) => startOtp(...a), verifyOtp: vi.fn() }));
vi.mock("@/native/deviceSignIn", () => ({ biometryAvailable: async () => false, isEnrolled: async () => false, offerFaceIdOnce: async () => undefined, signInWithFaceId: vi.fn() }));
vi.mock("@/auth/passkeys", () => ({ passkeysSupported: () => false, signInWithPasskey: vi.fn(), PasskeyError: class extends Error {} }));

import SignInPage, { SIGN_IN_FALLBACK, signInErrorMessage } from "../SignInPage";

afterEach(() => { cleanup(); startOtp.mockReset(); });

describe("sign-in error text", () => {
  it("prefers the server's message field", () => {
    expect(signInErrorMessage(new ApiError(429, "otp_busy", undefined, "Codes are delayed. Try again in 2 minutes."))).toBe("Codes are delayed. Try again in 2 minutes.");
  });

  it.each([
    ["unsupported_country", /Canadian and US mobile numbers/],
    ["otp_phone_daily_limit", /too many codes today/],
    ["otp_busy", /sending a lot of codes/],
    ["missing_code", /Enter the 6-digit code/],
    ["invalid_otp", /code was not right/],
    ["otp_rate_limited", /Too many attempts/],
  ])("has a sentence for %s", (code, text) => {
    const msg = signInErrorMessage(new ApiError(400, code));
    expect(msg).toMatch(text);
    expect(msg).not.toBe(SIGN_IN_FALLBACK);
  });

  it("falls back only when there is no message and no known code", () => {
    expect(SIGN_IN_FALLBACK).toBe("Something went wrong. Please try again.");
    expect(signInErrorMessage(new ApiError(500, "request_failed_500"))).toBe(SIGN_IN_FALLBACK);
    expect(signInErrorMessage(new Error("boom"))).toBe(SIGN_IN_FALLBACK);
  });

  it("shows the server message on the page when sending a code fails", async () => {
    startOtp.mockRejectedValue(new ApiError(400, "unsupported_country", undefined, "We only text numbers in Canada and the US."));
    render(<MemoryRouter><SignInPage /></MemoryRouter>);
    // A complete number sends the code on its own.
    fireEvent.change(screen.getByLabelText(/Mobile number/), { target: { value: "+44 20 7946 0000" } });
    expect(await screen.findByText("We only text numbers in Canada and the US.")).toBeTruthy();
    expect(screen.queryByText(SIGN_IN_FALLBACK)).toBeNull();
    expect(startOtp).toHaveBeenCalledWith("+44 20 7946 0000");
    // A refused number is not re-sent in a loop; the button still retries it.
    await new Promise((r) => setTimeout(r, 50));
    expect(startOtp).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole("button", { name: "Send code" }));
    await screen.findByText("We only text numbers in Canada and the US.");
    expect(startOtp).toHaveBeenCalledTimes(2);
  });
});
