import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

const src = fs.readFileSync(path.join(process.cwd(), "src/pages/SignInPage.tsx"), "utf8");

describe("BI_CLIENT_OTP_AUTOFILL_v168", () => {
  it("carries every attribute the working BF-client field has", () => {
    // BF-client's PhoneOTPInline fires the Chrome SMS bubble with exactly these.
    for (const attr of ['type="text"', 'name="otp"', 'autoComplete="one-time-code"', 'inputMode="numeric"']) {
      expect(src).toContain(attr);
    }
  });

  it("keeps the 6-digit limit", () => {
    expect(src).toContain("maxLength={6}");
  });

  it("strips non-digits so a pasted code cannot carry stray characters", () => {
    expect(src).toMatch(/replace\(\/\\D\+\/g, ""\)/);
    expect(src).toContain("slice(0, 6)");
  });

  it("warns the next person not to strip the attributes", () => {
    // A prior BF-client change removed them and suppressed the bubble.
    expect(src).toMatch(/Do not remove these attributes/i);
  });
});
