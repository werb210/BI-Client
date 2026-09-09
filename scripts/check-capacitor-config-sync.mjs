// BI_CLIENT_CONFIG_DRIFT_GATE_v1
// ios/App/App/capacitor.config.json is committed and is what the app reads at
// runtime. It drifted from capacitor.config.ts and nothing noticed: the source
// said launchShowDuration 0, the shipped file said 3000, and the app kept
// crashing on a fix that was already in git.
import { readFileSync, existsSync } from "node:fs";
import { execSync } from "node:child_process";

const GENERATED = "ios/App/App/capacitor.config.json";

if (!existsSync(GENERATED)) {
console.error(`FAIL: ${GENERATED} is missing. Run: npx cap sync ios`);
process.exit(1);
}

const before = readFileSync(GENERATED, "utf8");

try {
execSync("npx cap sync ios", { stdio: "pipe" });
} catch (error) {
console.error("FAIL: cap sync did not complete");
console.error(String(error.stdout ?? error));
process.exit(1);
}

const after = readFileSync(GENERATED, "utf8");

if (before !== after) {
console.error(`FAIL: ${GENERATED} is stale.`);
console.error("The committed file does not match what capacitor.config.ts produces,");
console.error("so the app would run with configuration that is not in source control.");
console.error("Fix: npm run build && npx cap sync ios && git add " + GENERATED);
console.error("\n--- committed ---\n" + before);
console.error("\n--- regenerated ---\n" + after);
process.exit(1);
}

// A plugin listed here is registered at launch regardless of the TS config.
const generated = JSON.parse(after);
const registered = generated.packageClassList ?? [];
const pkg = JSON.parse(readFileSync("package.json", "utf8"));
const installed = Object.keys(pkg.dependencies ?? {});

if (registered.includes("SplashScreenPlugin") && !installed.includes("@capacitor/splash-screen")) {
console.error("FAIL: SplashScreenPlugin is registered but the package is not installed.");
process.exit(1);
}

console.log(`OK: ${GENERATED} matches capacitor.config.ts (${registered.length} plugins registered)`);
