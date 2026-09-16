// BI_CLIENT_APPLICATION_PROGRESS_v280
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { stepMarker } from "../ApplicationProgress";

describe("progress markers", () => {
  it("draws a tick, warning or cross from the server's step state", () => {
    expect(stepMarker("done")).toBe("✓");
    expect(stepMarker("attention")).toBe("!");
    expect(stepMarker("stopped")).toBe("×");
    expect(stepMarker("current")).toBe("");
  });
});

describe("wiring", () => {
  const component = readFileSync(join(__dirname, "..", "ApplicationProgress.tsx"), "utf8");
  const home = readFileSync(join(__dirname, "..", "..", "pages", "HomePage.tsx"), "utf8");
  it("reads BI-Server's applicant progress and refreshes on resume", () => {
    expect(component).toContain('api.get<{ progress: ApplicantProgress | null }>("/applicants/me/progress")');
    expect(component).toContain('addEventListener("boreal:native-resume"');
  });
  it("sits above the Action Center on the home screen", () => {
    expect(home.indexOf("<ApplicationProgress />")).toBeGreaterThan(-1);
    expect(home.indexOf("<ApplicationProgress />")).toBeLessThan(home.indexOf("<ActionCenter"));
  });
});
