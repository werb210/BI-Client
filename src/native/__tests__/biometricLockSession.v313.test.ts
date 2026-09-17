// BI_CLIENT_LOCK_SESSION_v313
import { describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

vi.mock("@/native/deviceSignIn", () => ({ isEnrolled: async () => true, refreshSessionForBackground: async () => "t" }));
import { LOCK_AFTER_MS, shouldLock, tokenExpiresWithin } from "../useBiometricLock";

const jwt = (exp: number) => `x.${btoa(JSON.stringify({ exp }))}.y`;
// BI_CLIENT_LOCK_ONLY_ENROLLED_v330
const base = { session: true, sessionUsable: true, enrolled: true, biometry: true, coldStart: false, backgroundedAt: null as number | null, now: 1_700_000_000_000 };

describe("BI Face ID lock", () => {
  it("reads when the one-hour session runs out", () => {
    const now = 1_700_000_000_000;
    expect(tokenExpiresWithin(jwt(now / 1000 + 3600), 5 * 60_000, now)).toBe(false);
    expect(tokenExpiresWithin(jwt(now / 1000 + 120), 5 * 60_000, now)).toBe(true);
    expect(tokenExpiresWithin(jwt(now / 1000 - 10), 0, now)).toBe(true);
    expect(tokenExpiresWithin("garbage", 0, now)).toBe(true);
  });
  it("does not lock an expired session the applicant cannot renew with Face ID", () => {
    expect(shouldLock({ ...base, coldStart: true, sessionUsable: false, enrolled: false })).toBe(false);
    expect(shouldLock({ ...base, coldStart: true, sessionUsable: false, enrolled: true })).toBe(true);
  });
  it("locks on cold start or after a minute away, not after a brief switch", () => {
    expect(shouldLock({ ...base, coldStart: true })).toBe(true);
    expect(shouldLock({ ...base, coldStart: true, enrolled: false })).toBe(false);
    expect(shouldLock({ ...base, enrolled: false, backgroundedAt: base.now - LOCK_AFTER_MS })).toBe(false);
    expect(shouldLock({ ...base, backgroundedAt: base.now - 5_000 })).toBe(false);
    expect(shouldLock({ ...base, backgroundedAt: base.now - LOCK_AFTER_MS })).toBe(true);
  });
  it("renews the session after unlock and listens for real backgrounding", () => {
    const hook = readFileSync(join(__dirname, "..", "useBiometricLock.ts"), "utf8");
    expect(hook).toContain("await refreshSessionForBackground(");
    expect(readFileSync(join(__dirname, "..", "NativeBridge.tsx"), "utf8")).toContain('addListener("pause"');
  });
});
