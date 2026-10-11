import { afterEach, describe, it, expect, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { Capacitor } from "@capacitor/core";
import { DocumentScanner } from "@capacitor-mlkit/document-scanner";
import {
  isScannerAvailable,
  ScannerUnavailableError,
  scanContractAsPdf,
  scanContractAsPdfWithQuality,
} from "@/native/documentScanner";
import UploadContractPage from "@/pages/UploadContractPage";

vi.mock("@capacitor-mlkit/document-scanner", () => ({ DocumentScanner: { scanDocument: vi.fn() } }));
vi.mock("@/api/contract", () => ({ uploadContract: vi.fn() }));

/** A phone: isNativePlatform() is true, and the plugin registry says whether the scanner was linked. */
function onDevice(pluginLinked: boolean) {
  vi.spyOn(Capacitor, "isNativePlatform").mockReturnValue(true);
  return vi.spyOn(Capacitor, "isPluginAvailable").mockImplementation((name: string) => pluginLinked && name === "DocumentScanner");
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.mocked(DocumentScanner.scanDocument).mockReset();
});

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
    const registry = onDevice(false);
    expect(isScannerAvailable()).toBe(false);
    expect(registry).toHaveBeenCalledWith("DocumentScanner");

    onDevice(true);
    expect(isScannerAvailable()).toBe(true);
  });

  it("guards the call so the raw plugin error never reaches the applicant", async () => {
    onDevice(false);
    vi.mocked(DocumentScanner.scanDocument).mockRejectedValue(new Error("\"DocumentScanner\" plugin is not implemented on ios"));
    await expect(scanContractAsPdf()).rejects.toBeInstanceOf(ScannerUnavailableError);
    await expect(scanContractAsPdfWithQuality()).rejects.toBeInstanceOf(ScannerUnavailableError);
    // The guard runs before the plugin is touched.
    expect(DocumentScanner.scanDocument).not.toHaveBeenCalled();
  });

  it("the upload page says something an applicant can act on", async () => {
    onDevice(false);
    vi.mocked(DocumentScanner.scanDocument).mockRejectedValue(new Error("\"DocumentScanner\" plugin is not implemented on ios"));
    render(<MemoryRouter><UploadContractPage /></MemoryRouter>);
    fireEvent.click(screen.getByRole("button", { name: "Scan Document" }));
    expect(await screen.findByText(/take a photo or choose a file/i)).toBeTruthy();
    expect(screen.queryByText(/not implemented/i)).toBeNull();
    expect(DocumentScanner.scanDocument).not.toHaveBeenCalled();
  });
});
