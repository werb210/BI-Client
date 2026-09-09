// BI_CLIENT_SPLASH_REMOVE_v1
import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import config from "../../capacitor.config";

const root = path.resolve(__dirname, "../..");
const splashPackage = ["@capacitor", "splash-screen"].join("/");

function read(rel: string) {
  return fs.readFileSync(path.join(root, rel), "utf8");
}

describe("splash-screen plugin is fully removed", () => {
  it("is not a dependency", () => {
    const pkg = JSON.parse(read("package.json"));
    expect(pkg.dependencies?.[splashPackage]).toBeUndefined();
  });

  it("is not imported by any source file", () => {
    // The build failed at Rollup because the package was uninstalled while
    // NativeBridge.tsx still imported it.
    const walk = (dir: string): string[] =>
      fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
        const full = path.join(dir, e.name);
        return e.isDirectory() ? walk(full) : /\.tsx?$/.test(e.name) ? [full] : [];
      });
    const offenders = walk(path.join(root, "src"))
      .filter((f) => fs.readFileSync(f, "utf8").includes(splashPackage))
      .map((f) => path.relative(root, f));
    expect(offenders).toEqual([]);
  });

  it("is absent from the Capacitor config", () => {
    expect(config.plugins?.SplashScreen).toBeUndefined();
  });

  it("keeps the Keyboard plugin config intact", () => {
    expect(config.plugins?.Keyboard?.resize).toBe("native");
  });

  it("is not registered in the generated native config", () => {
    // packageClassList is what the runtime actually loads; SplashScreenPlugin
    // there means the recursion is still reachable regardless of the TS config.
    const generated = JSON.parse(read("ios/App/App/capacitor.config.json"));
    expect(generated.packageClassList).not.toContain("SplashScreenPlugin");
  });

  it("keeps the generated config in step with the source", () => {
    // A stale generated file is what made the first two fix attempts fail: the
    // TS config was correct and the app read the old JSON.
    const generated = JSON.parse(read("ios/App/App/capacitor.config.json"));
    expect(generated.appId).toBe(config.appId);
    expect(Object.keys(generated.plugins ?? {}).sort())
      .toEqual(Object.keys(config.plugins ?? {}).sort());
  });
});
