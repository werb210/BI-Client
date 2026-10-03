// BI_CLIENT_FEATURE_TOUR_v720
import { describe, it, expect, vi, beforeEach } from "vitest";
import { readFileSync } from "node:fs";

vi.mock("@capacitor/core", () => ({ Capacitor: { isNativePlatform: () => true, getPlatform: () => "ios" } }));
vi.mock("@capacitor/push-notifications", () => ({ PushNotifications: {} }));
vi.mock("@/native/deviceSignIn", () => ({ biometryStatus: async () => ({ native: true, available: true, reason: "" }), isEnrolled: async () => false, enrollDeviceWithReason: async () => ({ ok: true }) }));
import { tourSteps, seen, markSeen, TOUR_KEY } from "../FeatureTour";

beforeEach(() => localStorage.clear());

describe("Boreal Risk feature tour", () => {
  it("is shown once: marking it seen sticks", () => {
    expect(seen()).toBe(false);
    markSeen();
    expect(localStorage.getItem(TOUR_KEY)).toBe("done");
    expect(seen()).toBe(true);
  });
  it("covers notifications, Face ID, scanning, sharing and the widget - no call step in this app", () => {
    expect(tourSteps("ios", { faceId: true }).map((s) => s.id)).toEqual(["welcome", "push", "faceid", "scan", "share", "widget"]);
    expect(tourSteps("ios", { faceId: false }).map((s) => s.id)).not.toContain("faceid");
  });
  it("words the widget and share steps for each phone", () => {
    expect(tourSteps("android", { faceId: false }).find((s) => s.id === "widget")!.body).toContain("Widgets");
    expect(tourSteps("ios", { faceId: false }).find((s) => s.id === "widget")!.body).toContain("Add Widget");
  });
  it("only opens in the installed app, and the home screen mounts it", () => {
    const src = readFileSync("src/components/onboarding/FeatureTour.tsx", "utf8");
    expect(src).toContain("if (!forceOpen && (!Capacitor.isNativePlatform() || seen())) return;");
    expect(readFileSync("src/pages/HomePage.tsx", "utf8")).toContain("<FeatureTour />");
  });
});
