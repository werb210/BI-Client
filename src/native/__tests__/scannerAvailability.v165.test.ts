import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { isScannerAvailable, ScannerUnavailableError, scanContractAsPdf } from "@/native/documentScanner";

const root = process.cwd();

describe("BI_CLIENT_SCANNER_AVAILABILITY_v165", () => {
  it("reports unavailable off-device", async () => {
    expect(isScannerAvailable()).toBe(false);
  });

  it("returns null off-device rather than throwing", async () => {
    // The web build has no scanner and no native guard to trip.
    expect(await scanContractAsPdf()).toBeNull();
  });

  it("carries a distinguishable error type", () => {
    const err = new ScannerUnavailableError();
    expect(err).toBeInstanceOf(Error);
    expect(err.name).toBe("ScannerUnavailableError");
    expect(err.message).toBe("scanner_unavailable");
  });

  it("checks the plugin registry, not just the platform", () => {
    // isNativePlatform() is true on iOS whether or not the plugin was linked,
    // which is exactly the case that was failing.
    const src = fs.readFileSync(path.join(root, "src/native/documentScanner.ts"), "utf8");
    expect(src).toContain('isPluginAvailable("DocumentScanner")');
  });

  it("guards the call so the raw plugin error never reaches the applicant", () => {
    const src = fs.readFileSync(path.join(root, "src/native/documentScanner.ts"), "utf8");
    const guardAt = src.indexOf("if (!isScannerAvailable()) throw new ScannerUnavailableError()");
    const callAt = src.indexOf("DocumentScanner.scanDocument(");
    expect(guardAt).toBeGreaterThan(-1);
    expect(guardAt).toBeLessThan(callAt);
  });

  it("the upload page says something an applicant can act on", () => {
    const page = fs.readFileSync(path.join(root, "src/pages/UploadContractPage.tsx"), "utf8");
    expect(page).toContain("ScannerUnavailableError");
    expect(page).toMatch(/take a photo or choose a file/i);
  });
});
