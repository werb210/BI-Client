// BI_CLIENT_CONFIG_DRIFT_GATE_v2
import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(__dirname, "../..");
const workflow = fs.readFileSync(
  path.join(root, ".github/workflows/azure-static-web-apps.yml"), "utf8");
const script = fs.readFileSync(
  path.join(root, "scripts/check-capacitor-config-sync.mjs"), "utf8");

describe("the drift gate runs where its inputs exist", () => {
  it("comes after the Build step", () => {
    // cap sync copies dist; before Build there is no dist.
    const build = workflow.indexOf("- name: Build");
    const gate = workflow.indexOf("- name: Capacitor config in sync");
    expect(build).toBeGreaterThan(-1);
    expect(gate).toBeGreaterThan(build);
  });

  it("comes before Deploy, so a drifted config never ships", () => {
    const gate = workflow.indexOf("- name: Capacitor config in sync");
    const deploy = workflow.indexOf("- name: Deploy");
    if (deploy > -1) expect(gate).toBeLessThan(deploy);
  });

  it("names the missing build rather than blaming config drift", () => {
    expect(script).toContain("dist/index.html is missing");
    expect(script).toContain("npm run build");
  });

  it("still compares the committed config against a fresh sync", () => {
    expect(script).toContain("before !== after");
  });
});
