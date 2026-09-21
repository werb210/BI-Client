// BI_CLIENT_LOCK_ORDER_v363
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const read = (...p: string[]) => readFileSync(join(__dirname, "..", ...p), "utf8");
const hook = read("useBiometricLock.ts");
const gate = read("BiometricGate.tsx");
const signIn = read("..", "pages", "SignInPage.tsx");

describe("Face ID lock decides before the app renders", () => {
  it("the hook reports when its first check is done", () => {
    expect(hook).toContain("const [ready, setReady] = useState(!Capacitor.isNativePlatform());");
    expect(hook).toContain("setLocked(false); setReady(true); return;");
    expect(hook).toContain("if (lock) setLocked(true);\n    setReady(true);");
    expect(hook).toContain("return { locked, ready, unlock };");
  });
  it("the gate renders nothing until ready, and the app only when unlocked", () => {
    const hold = gate.indexOf("if (!ready) return");
    const pass = gate.indexOf("if (!locked) return <>{children}</>;");
    expect(hold).toBeGreaterThan(-1);
    expect(hold).toBeLessThan(pass);
  });
  it("a renewed session is announced and the sign-in page leaves", () => {
    expect(hook).toContain('window.dispatchEvent(new Event("boreal:session-renewed"))');
    expect(signIn).toContain('window.addEventListener("boreal:session-renewed", leaveIfSignedIn);');
    expect(signIn).toContain("if (!tokenExpiresWithin(getCachedToken(), 0)) void signedInDestination()");
  });
});
