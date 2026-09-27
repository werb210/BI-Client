// BI_CLIENT_BLOCK_v613
import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync } from "node:fs";

const NEWLINE = String.fromCharCode(10);

describe("iOS plugins", () => {
  it("declare pluginMethods as [CAPPluginMethod] (an inferred type breaks CAPBridgedPlugin)", () => {
    for (const f of readdirSync("ios/App/App").filter((n) => n.endsWith(".swift"))) {
      const src = readFileSync(`ios/App/App/${f}`, "utf8");
      const lines = src.split(NEWLINE).filter((l) => l.includes("let pluginMethods"));
      for (const line of lines) expect(line, `${f}: ${line.trim()}`).toContain("pluginMethods: [CAPPluginMethod]");
    }
  });
});
