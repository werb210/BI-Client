// BI_CLIENT_BLOCK_v605
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { clearClientWidget, mergeWidget, widgetStage } from "../clientWidget";

describe("v605 widget fixes", () => {
  it("shows the progress sentence as written and keeps stage and count independently", async () => {
    expect(widgetStage("We are reviewing your application")).toBe("We are reviewing your application");
    await clearClientWidget();
    expect(mergeWidget("We are reviewing your application", undefined)).toEqual({ stage: "We are reviewing your application", toDoCount: 0 });
    expect(mergeWidget(undefined, 3)).toEqual({ stage: "We are reviewing your application", toDoCount: 3 });
    expect(mergeWidget("Coverage approved", undefined)).toEqual({ stage: "Coverage approved", toDoCount: 3 });
    await clearClientWidget();
    expect(mergeWidget(undefined, undefined)).toEqual({ stage: "Application in progress", toDoCount: 0 });
  });

  it("stage comes from progress, count from the action centre", () => {
    expect(readFileSync("src/components/ApplicationProgress.tsx", "utf8")).toContain("updateClientWidget(r.progress?.headline, undefined)");
    expect(readFileSync("src/components/ActionCenter.tsx", "utf8")).toContain("updateClientWidget(undefined, d?.outstandingCount, m.actionLine(d?.outstanding), applicationId)"); // BI_CLIENT_WIDGET_SELF_REFRESH_v675 // BI_CLIENT_WIDGET_BRAND_v631
  });

  it("widget extension has its identity keys and matching versions", () => {
    const plist = readFileSync("ios/App/ClientWidgetExtension/Info.plist", "utf8");
    for (const k of ["CFBundleExecutable", "CFBundleIdentifier", "CFBundleVersion", "CFBundleShortVersionString", "CFBundlePackageType"]) expect(plist).toContain(k);
    const pbx = readFileSync("ios/App/App.xcodeproj/project.pbxproj", "utf8");
    expect(pbx.match(/ClientWidgetExtension\.entitlements; CODE_SIGN_STYLE = Automatic; CURRENT_PROJECT_VERSION = 1; MARKETING_VERSION = 1\.0;/g)?.length).toBe(2);
  });
});
