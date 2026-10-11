// BI_CLIENT_BLOCK_v605
import { readFileSync } from "node:fs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, waitFor } from "@testing-library/react";

const apiGet = vi.hoisted(() => vi.fn());
vi.mock("@/api/client", () => ({ api: { get: apiGet, post: vi.fn() }, apiRequest: vi.fn() }));
vi.mock("@/native/clientWidget", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/native/clientWidget")>()),
  updateClientWidget: vi.fn(async () => undefined),
}));

import ActionCenter from "@/components/ActionCenter";
import ApplicationProgress from "@/components/ApplicationProgress";
import { clearClientWidget, mergeWidget, updateClientWidget, widgetStage } from "@/native/clientWidget";

beforeEach(() => { apiGet.mockReset(); vi.mocked(updateClientWidget).mockClear(); });
afterEach(() => cleanup());

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

  it("the stage comes from the progress headline (and only the stage)", async () => {
    apiGet.mockResolvedValue({
      progress: { publicId: "APP-1", headline: "We are reviewing your application", detail: "Usually a day.", steps: [{ key: "s", label: "Submitted", state: "done" }], updatedAt: null },
    });
    render(<ApplicationProgress />);
    await waitFor(() => expect(updateClientWidget).toHaveBeenCalledWith("We are reviewing your application", undefined));
    expect(apiGet).toHaveBeenCalledWith("/applicants/me/progress");
    expect(updateClientWidget).toHaveBeenCalledTimes(1);
  });

  it("the count (and action line) comes from the action centre", async () => {
    apiGet.mockResolvedValue({
      applicationId: "APP-1",
      outstanding: [
        { key: "a", kind: "document", label: "Certificate", urgent: false },
        { key: "b", kind: "document", label: "Licence", urgent: false },
      ],
      completed: [],
      outstandingCount: 2,
      canSubmit: false,
    });
    render(<ActionCenter applicationId="APP-1" />);
    await waitFor(() => expect(updateClientWidget).toHaveBeenCalledWith(undefined, 2, "Upload 2 documents", "APP-1"));
    expect(updateClientWidget).toHaveBeenCalledTimes(1);
  });

  it("widget extension has its identity keys and matching versions", () => {
    const plist = readFileSync("ios/App/ClientWidgetExtension/Info.plist", "utf8");
    for (const k of ["CFBundleExecutable", "CFBundleIdentifier", "CFBundleVersion", "CFBundleShortVersionString", "CFBundlePackageType"]) expect(plist).toContain(k);
    const pbx = readFileSync("ios/App/App.xcodeproj/project.pbxproj", "utf8");
    expect(pbx.match(/ClientWidgetExtension\.entitlements; CODE_SIGN_STYLE = Automatic; CURRENT_PROJECT_VERSION = 1; MARKETING_VERSION = 1\.0;/g)?.length).toBe(2);
  });
});
