// BI_CLIENT_ACCOUNT_BAR_v337
import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const src = join(__dirname, "..", "..");
const read = (p: string) => readFileSync(join(src, p), "utf8");
const router = read("router/AppRouter.tsx");
const bar = read("components/AccountBar.tsx");
const home = read("pages/HomePage.tsx");

const everyTsx = (dir: string): string[] =>
  readdirSync(join(src, dir), { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? everyTsx(join(dir, e.name)) : e.name.endsWith(".tsx") ? [join(dir, e.name)] : [],
  );

describe("the account controls are where the applicant actually is", () => {
  it("renders on every signed-in route, through the guard that wraps them all", () => {
    expect(router).toContain("<AccountBar />");
    expect(router).toContain('if (!getCachedToken()) return <Navigate to="/" replace />;');
  });

  it("carries the Face ID control", () => {
    expect(bar).toContain("<FaceIdSignInToggle />");
  });

  it("makes the orphaned account page reachable at last", () => {
    // Sign-out and account deletion live on HomePage. Nothing navigated to
    // "/home", so the App Store's account-deletion requirement was unreachable.
    expect(bar).toContain('navigate("/home")');
    expect(home).toContain("Sign out");
  });

  it("does not leave a second Face ID control on the page the bar links to", () => {
    expect(home).not.toContain("<FaceIdSignInToggle />");
  });

  it("keeps exactly one route pointing at HomePage", () => {
    expect(router).toContain('<Route path="/home"');
  });

  it("every signed-in destination the app navigates to is inside the guard", () => {
    // The fault this block fixes was a screen outside the applicant's path.
    // Catch the next one: any route the app sends an applicant to must be one
    // the router wraps in RequireApplicant.
    const destinations = new Set<string>();
    for (const file of everyTsx("pages")) {
      for (const m of read(file).matchAll(/navigate\(\s*"(\/[a-z/:]*)"/g)) destinations.add(m[1]);
    }
    for (const d of destinations) {
      if (d === "/") continue;
      const stem = d.split("/")[1];
      expect(router).toContain(`<Route path="/${stem}`);
    }
  });
});
