// BI_CLIENT_STEP1_PROFILE_v3
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

const read = (rel: string) => readFileSync(path.join(process.cwd(), rel), "utf8");
const page = read("src/pages/StartPage.tsx");
const router = read("src/router/AppRouter.tsx");
const signIn = read("src/pages/SignInPage.tsx");
const token = read("src/auth/token.ts");
const otp = read("src/api/otp.ts");

describe("step 1 collects exactly the fields we do not already have", () => {
  it("asks for business name, applicant name and email", () => {
    for (const id of ["businessName", "applicantName", "email"]) expect(page).toContain(`id="${id}"`);
  });
  it("shows the OTP phone read-only instead of asking again", () => {
    expect(page).toContain("getPhone()");
    expect(page).toContain("Already confirmed by the code you entered.");
    expect(page).not.toContain('id="phone"');
  });
  it("serves both countries", () => {
    expect(page).toContain('<option value="CA">Canada</option>');
    expect(page).toContain('<option value="US">United States</option>');
  });
});

describe("the phone survives the sign-in", () => {
  it("is stored on verify and cleared with the token", () => {
    expect(otp).toContain("setPhone(r.phone || toE164(phone))");
    expect(token).toContain("boreal_bi_applicant_phone");
    expect(token.slice(token.indexOf("export function clearToken"))).toContain("PHONE_KEY");
  });
});

describe("sign-in leads into step 1", () => {
  it("uses /start as the normal post-OTP fallback", () => {
    expect(signIn).toContain(
      'navigate(consumeNativeDestination() ?? "/start")'
    );
    expect(signIn).toContain(
      'import { consumeNativeDestination } from "@/native/deepLinks"'
    );
    expect(router).toContain('path="/start"');
    expect(router).toContain("<StartPage />");
  });
  it("keeps step 1 behind the applicant guard", () => expect(router).toContain("<RequireApplicant><StartPage /></RequireApplicant>"));
});

describe("mobile-first, per locked ruling 23", () => {
  it("uses 56px targets and a sticky CTA", () => {
    expect(page).toContain("minHeight: 56");
    expect(page).toContain('position: "fixed"');
  });
  it("sets input modes so the phone shows the right keyboard", () => {
    expect(page).toContain('inputMode="email"');
    expect(page).toContain('autoComplete="organization"');
  });
  it("does not let a half-filled form submit", () => expect(page).toContain("disabled={!ready || busy}"));
});
