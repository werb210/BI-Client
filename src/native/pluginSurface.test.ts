import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(new URL(`../../${path}`, import.meta.url), "utf8");

describe("native plugin runtime surface", () => {
  it("keeps native authentication on secure storage without a plaintext fallback", () => {
    const source = read("src/auth/token.ts");

    expect(source).toContain('from "@aparajita/capacitor-secure-storage"');
    expect(source).toMatch(/if \(native\(\)\)[\s\S]*SecureStorage\.set/);
    expect(source).toContain("SecureStorage.remove(APPLICANT_TOKEN_KEY)");
    expect(source).toContain("Secure storage failure is fail-closed");
  });

  it("keeps native document and photo selection on native plugins", () => {
    const source = read("src/pages/UploadContractPage.tsx");

    expect(source).toContain('from "@capawesome/capacitor-file-picker"');
    expect(source).toContain("native ? void chooseNativeFile() : inputRef.current?.click()");
    expect(source).toContain("FilePicker.pickFiles(");
    expect(source).toContain('from "@capacitor/camera"');
    expect(source).toContain("Camera.getPhoto(");
    expect(source).toContain('from "@capacitor/network"');
  });

  it("keeps the active App, Preferences, and native file normalization surfaces", () => {
    expect(read("src/native/NativeBridge.tsx")).toContain('from "@capacitor/app"');
    expect(read("src/auth/token.ts")).toContain('from "@capacitor/preferences"');
    expect(read("src/upload/normalize.ts")).toContain("normalizeNativeSource");
  });

  it("preserves declared Device and Filesystem native scope", () => {
    const dependencies = JSON.parse(read("package.json")).dependencies;

    expect(dependencies).toHaveProperty("@capacitor/device");
    expect(dependencies).toHaveProperty("@capacitor/filesystem");
  });
});
