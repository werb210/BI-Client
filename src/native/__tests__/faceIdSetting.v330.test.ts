// BI_CLIENT_FACE_ID_SETTING_v330
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { shouldLock } from "../useBiometricLock";

const src = join(__dirname, "..", "..");
const read = (path: string) => readFileSync(join(src, path), "utf8");
const toggle = read("components/FaceIdSignInToggle.tsx");
const device = read("native/deviceSignIn.ts");
const home = read("pages/HomePage.tsx");
const base = { session: true, sessionUsable: true, enrolled: true, biometry: true, coldStart: true, backgroundedAt: null, now: 0 };

describe("no Face ID prompt for an applicant who never turned it on", () => {
  it("does not lock a cold start when not enrolled", () => expect(shouldLock({ ...base, enrolled: false })).toBe(false));
  it("does not lock after time away when not enrolled", () => expect(shouldLock({ ...base, enrolled: false, coldStart: false, backgroundedAt: 0, now: 600_000 })).toBe(false));
  it("still locks a cold start once enrolled", () => expect(shouldLock(base)).toBe(true));
  it("still ignores a brief switch away", () => expect(shouldLock({ ...base, coldStart: false, backgroundedAt: 0, now: 5_000 })).toBe(false));
  it("locks an expired session when enrolled", () => expect(shouldLock({ ...base, sessionUsable: false })).toBe(true));
});

describe("there is a visible way to turn Face ID on", () => {
  it("the home screen renders the row", () => expect(home).toContain("<FaceIdSignInToggle />"));
  it("shows unavailable reasons", () => expect(toggle).toContain('data-testid="face-id-unavailable"'));
  it("offers both directions", () => {
    expect(toggle).toContain("await enrollThisDevice()");
    expect(toggle).toContain("await disableFaceIdSignIn()");
  });
});

describe("the one-shot prompt can no longer lock a device out", () => {
  it("no longer uses window.confirm", () => expect(device).not.toContain('window.confirm("Use Face ID'));
  it("clears the old flag", () => expect(device).toContain("localStorage.removeItem(OFFERED_KEY);"));
  it("uses a session hint", () => expect(device).toContain('sessionStorage.setItem(HINT_KEY, "1");'));
  it("exports enrollment", () => expect(device).toContain("export async function enrollThisDevice(): Promise<boolean> {"));
});
