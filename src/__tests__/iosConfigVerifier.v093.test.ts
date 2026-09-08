// BI_CLIENT_BLOCK_v093_VERIFIER_WHITESPACE_TOLERANT_v1
import { describe, expect, it } from "vitest";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(__dirname, "../..");
const projectPath = path.join(root, "ios/App/App.xcodeproj/project.pbxproj");

function runVerifier(): { ok: boolean; output: string } {
  try {
    return { ok: true, output: execFileSync("node", ["scripts/verify-ios-config.mjs"], { cwd: root, encoding: "utf8" }) };
  } catch (error) {
    return { ok: false, output: String((error as { stderr?: string }).stderr ?? error) };
  }
}

describe("iOS config verifier", () => {
  it("passes on the committed project", () => {
    const result = runVerifier();
    expect(result.output).toContain("guardrails passed");
    expect(result.ok).toBe(true);
  });

  it("passes when the pbxproj uses the compact single-line object layout", () => {
    // 501b6bd flipped this project from compact to expanded and the verifier
    // silently stopped matching. Both layouts are valid Xcode output.
    const original = fs.readFileSync(projectPath, "utf8");
    const compact = original.replace(
      /([A-F0-9]+)(\s*\/\*[^*]*\*\/)?\s*=\s*\{\s*\n\s*isa = XCConfigurationList;\s*\n\s*buildConfigurations = \(\s*\n([\s\S]*?)\n\s*\);\s*\n\s*defaultConfigurationIsVisible = 0;\s*\n\s*defaultConfigurationName = Release;\s*\n\s*\};/g,
      (_m, id, _c, body) =>
        `${id} = {isa = XCConfigurationList; buildConfigurations = (${body.trim().replace(/\s*\n\s*/g, " ")}); defaultConfigurationIsVisible = 0; defaultConfigurationName = Release; };`,
    );
    expect(compact).not.toBe(original); // the rewrite must actually apply
    try {
      fs.writeFileSync(projectPath, compact);
      expect(runVerifier().ok).toBe(true);
    } finally {
      fs.writeFileSync(projectPath, original);
    }
  });
});
