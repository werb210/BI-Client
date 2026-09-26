// BI_CLIENT_BLOCK_v554_SHARE_TO_BOREAL
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { fileNameFromUrl, holdSharedUrl, isSharedFileUrl, mimeFor, takeShared } from "../sharedFiles";

describe("v554 share a subcontract to Boreal Risk", () => {
  it("tells a shared file from a deep link", () => {
    expect(isSharedFileUrl("file:///var/mobile/Inbox/Subcontract%20A.pdf")).toBe(true);
    expect(isSharedFileUrl("content://com.android.providers/1")).toBe(true);
    expect(isSharedFileUrl("borealrisk://upload")).toBe(false);
  });
  it("holds the file with its name and type until the upload page takes it", () => {
    holdSharedUrl("file:///x/Inbox/Subcontract%20A.pdf");
    expect(takeShared()).toEqual({ path: "file:///x/Inbox/Subcontract%20A.pdf", name: "Subcontract A.pdf", mimeType: "application/pdf" });
    expect(takeShared()).toBeNull();
    expect(fileNameFromUrl("not a url")).toBe("contract");
    expect(mimeFor("scan", "image/jpeg")).toBe("image/jpeg");
  });
  it("shared files open the upload page, after sign-in if needed", () => {
    const bridge = readFileSync("src/native/NativeBridge.tsx", "utf-8");
    expect(bridge).toContain("if (isSharedFileUrl(url)) { holdSharedUrl(url); openUpload(); return; }");
    expect(bridge).toContain('retainNativeDestination("/upload")');
    expect(bridge.indexOf("getLaunchUrl()")).toBeLessThan(bridge.indexOf('addListener("appUrlOpen"'));
  });
  it("the upload page sends a shared file like a picked one", () => {
    const page = readFileSync("src/pages/UploadContractPage.tsx", "utf-8");
    expect(page).toContain("const shared = takeShared();");
    expect(page).toContain(".then((file) => send(file))");
  });
  it("native wiring", () => {
    expect(readFileSync("ios/App/App/Info.plist", "utf-8")).toContain("<key>CFBundleDocumentTypes</key>");
    expect(readFileSync("android/app/src/main/AndroidManifest.xml", "utf-8")).toContain("android.intent.action.SEND");
    expect(readFileSync("android/app/src/main/java/com/boreal/risk/client/MainActivity.java", "utf-8")).toContain("registerPlugin(SharedFilesPlugin.class)");
  });
});
