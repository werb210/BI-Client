// BI_CLIENT_ENROLL_REASON_v336
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const src = join(__dirname, "..", "..");
const read = (p: string) => readFileSync(join(src, p), "utf8");
const device = read("native/deviceSignIn.ts");
const toggle = read("components/FaceIdSignInToggle.tsx");

describe("a failed enrollment says which step failed", () => {
  it("separates the four causes instead of collapsing them to false", () => {
    for (const stage of ['"biometry"', '"session"', '"cancelled"', '"server"']) {
      expect(device).toContain(stage);
    }
  });

  it("names the expired session, which is the likeliest cause on a one-hour token", () => {
    expect(device).toContain("error instanceof ApiError && error.status === 401");
    expect(device).toContain("Your sign-in expired.");
  });

  it("treats a dismissed prompt as a choice, with no error on screen", () => {
    expect(device).toContain('return { ok: false, stage: "cancelled", message: "" };');
    expect(toggle).toContain("if (!result.ok && result.message) setError(result.message);");
  });

  it("logs the status and code, not just a message", () => {
    expect(device).toContain('console.error("face_id_enroll_failed"');
    expect(device).toContain("error instanceof ApiError ? error.status : null");
  });

  it("keeps the boolean form for callers that only need yes or no", () => {
    expect(device).toContain("export async function enrollThisDevice(): Promise<boolean> {");
    expect(device).toContain("return (await enrollDeviceWithReason()).ok;");
  });
});
