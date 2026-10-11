// BI_CLIENT_BLOCK_v554_SHARE_TO_BOREAL - the native side of sharing a file to Boreal Risk.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("v554 share a subcontract to Boreal Risk (native projects)", () => {
  it("native wiring", () => {
    expect(readFileSync("ios/App/App/Info.plist", "utf-8")).toContain("<key>CFBundleDocumentTypes</key>");
    expect(readFileSync("android/app/src/main/AndroidManifest.xml", "utf-8")).toContain("android.intent.action.SEND");
    expect(readFileSync("android/app/src/main/java/com/boreal/risk/client/MainActivity.java", "utf-8")).toContain("registerPlugin(SharedFilesPlugin.class)");
  });
});
