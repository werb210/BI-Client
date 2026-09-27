// BI_CLIENT_BLOCK_v603_HOME_WIDGET
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { widgetStage, widgetToDoCount } from "../clientWidget";
describe("v603 client widget", () => {
  it("normalizes untrusted server display values", () => { expect(widgetStage("ready_for_submission")).toBe("Ready For Submission"); expect(widgetStage(null)).toBe("Application In Progress"); expect(widgetToDoCount(200)).toBe(99); expect(widgetToDoCount(-2)).toBe(0); });
  it("wires both native widgets and shortcuts", () => { expect(readFileSync("android/app/src/main/res/xml/client_widget_info.xml","utf8")).toContain('home_screen|keyguard'); expect(readFileSync("ios/App/ClientWidgetExtension/ClientWidget.swift","utf8")).toContain(".accessoryRectangular"); expect(readFileSync("ios/App/App/AppDelegate.swift","utf8")).toContain("UIApplicationShortcutItem"); });
});
