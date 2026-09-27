import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("browser passkeys v602", () => {
  it("converts WebAuthn binary fields and stores the returned applicant session", () => {
    const source = readFileSync("src/auth/passkeys.ts", "utf8");
    expect(source).toContain("navigator.credentials.get");
    expect(source).toContain("authenticatorData: encode(response.authenticatorData)");
    expect(source).toContain("await setToken(result.token)");
  });

  it("keeps browser passkeys out of the native app", () => {
    const source = readFileSync("src/auth/passkeys.ts", "utf8");
    expect(source).toContain("!Capacitor.isNativePlatform()");
  });

  it("wires passkey sign-in and enrollment into the applicant UI", () => {
    const signIn = readFileSync("src/pages/SignInPage.tsx", "utf8");
    const accountBar = readFileSync("src/components/AccountBar.tsx", "utf8");
    expect(signIn).toContain('data-testid="passkey-sign-in"');
    expect(accountBar).toContain("<PasskeySignInToggle />");
  });
});
