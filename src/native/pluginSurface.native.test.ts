// The native plugins the app declares, beyond the ones src/ code exercises.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("native plugin runtime surface (package)", () => {
  it("preserves declared Device and Filesystem native scope", () => {
    const dependencies = JSON.parse(readFileSync("package.json", "utf8")).dependencies;
    expect(dependencies).toHaveProperty("@capacitor/device");
    expect(dependencies).toHaveProperty("@capacitor/filesystem");
  });
});
