// BI_CLIENT_NATIVE_WIRING_v237
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const read = (p: string) => readFileSync(p, "utf-8");

describe("iOS native wiring", () => {
  it("registers the VisionKit scanner through a bridge subclass", () => {
    const swift = read("ios/App/App/DocumentScannerPlugin.swift");
    expect(swift).toContain("class BorealBridgeViewController: CAPBridgeViewController");
    expect(swift).toContain("registerPluginInstance(DocumentScannerPlugin())");
  });
  it("points the storyboard at that subclass in the App module", () => {
    const sb = read("ios/App/App/Base.lproj/Main.storyboard");
    expect(sb).toContain('customClass="BorealBridgeViewController" customModule="App"');
    expect(sb).not.toContain('customClass="CAPBridgeViewController"');
  });
  it("declares the Face ID usage string", () => {
    expect(read("ios/App/App/Info.plist")).toContain("<key>NSFaceIDUsageDescription</key>");
  });
});

describe("Action Center actions", () => {
  const cmp = read("src/components/ActionCenter.tsx");
  const home = read("src/pages/HomePage.tsx");
  it("renders a button only when a handler and a resolved application exist", () => {
    expect(cmp).toContain("onAction && data.applicationId ?");
    expect(cmp).toContain('item.kind === "document" ? "Upload" : "Answer"');
  });
  it("is on the home screen, resolved server-side with me", () => {
    expect(home).toContain('applicationId="me"');
    expect(home).toContain("/requirements/");
    expect(home).toContain("/questions/");
  });
  it("still leaves the requirements page mount untouched", () => {
    expect(read("src/pages/RequirementsPage.tsx")).toContain("<ActionCenter applicationId={applicationId} />");
  });
});
