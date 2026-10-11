// BI_CLIENT_BLOCK_v604_SCAN_QUALITY
import { afterEach, beforeEach, describe, it, expect, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useParams } from "react-router-dom";
import { Capacitor } from "@capacitor/core";
import type { QualityReport } from "@/upload/quality";
import { ApiError } from "@/api/client";
import { uploadContract } from "@/api/contract";
import { scanContractAsPdfWithQuality, worstPage } from "../documentScanner";
import UploadContractPage from "@/pages/UploadContractPage";

vi.mock("@capacitor-mlkit/document-scanner", () => ({ DocumentScanner: { scanDocument: vi.fn() } }));
vi.mock("../documentScanner", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  scanContractAsPdfWithQuality: vi.fn(),
}));
vi.mock("@/api/contract", () => ({ uploadContract: vi.fn() }));

const r = (issues: any[], sharpness: number) => ({ ok: issues.length === 0, issues, sharpness, width: 1200, height: 1600 });

describe("scanned contract quality", () => {
  it("reports the worst page and ignores good or unmeasured pages", () => {
    expect(worstPage([r([], 90), null])).toBeNull();
    expect(worstPage([r(["too_blurry"], 30), r(["too_blurry", "too_small"], 40), r([], 99)])?.issues).toEqual(["too_blurry", "too_small"]);
    expect(worstPage([r(["too_blurry"], 30), r(["too_blurry"], 10)])?.sharpness).toBe(10);
  });
});

describe("the upload page after a scan", () => {
  const scanned = () => new File(["%PDF-1.4"], "contract-scan.pdf", { type: "application/pdf" });
  const blurry: QualityReport = { ok: false, issues: ["too_blurry"], sharpness: 12, width: 1200, height: 1600 };

  function Requirements() {
    return <p>requirements for {useParams().applicationId}</p>;
  }
  function renderPage() {
    render(
      <MemoryRouter initialEntries={["/upload"]}>
        <Routes>
          <Route path="/upload" element={<UploadContractPage />} />
          <Route path="/requirements/:applicationId" element={<Requirements />} />
        </Routes>
      </MemoryRouter>,
    );
    fireEvent.click(screen.getByRole("button", { name: "Scan Document" }));
  }

  beforeEach(() => {
    vi.spyOn(Capacitor, "isNativePlatform").mockReturnValue(true);
  });
  afterEach(() => {
    vi.restoreAllMocks();
    vi.mocked(uploadContract).mockReset();
    vi.mocked(scanContractAsPdfWithQuality).mockReset();
  });

  it("uploads a poor scan anyway and moves on", async () => {
    const file = scanned();
    vi.mocked(scanContractAsPdfWithQuality).mockResolvedValue({ file, quality: blurry });
    vi.mocked(uploadContract).mockResolvedValue({ applicationId: "app-9", documentId: "d1", requirements: [] });
    renderPage();
    expect(await screen.findByText("requirements for app-9")).toBeTruthy();
    expect(scanContractAsPdfWithQuality).toHaveBeenCalledTimes(1);
    expect(uploadContract).toHaveBeenCalledWith(file);
  });

  it("warns about the scanned page when the scan is poor, and still sends it", async () => {
    const file = scanned();
    vi.mocked(scanContractAsPdfWithQuality).mockResolvedValue({ file, quality: blurry });
    vi.mocked(uploadContract).mockRejectedValue(new ApiError(500, "server_error"));
    renderPage();
    const warning = await screen.findByTestId("upload-warning");
    expect(warning.textContent).toBe("Scanned page: This looks blurry. Hold steady and try again in better light.");
    expect(uploadContract).toHaveBeenCalledWith(file);
  });

  it("says nothing about quality after a good scan", async () => {
    vi.mocked(scanContractAsPdfWithQuality).mockResolvedValue({ file: scanned(), quality: null });
    vi.mocked(uploadContract).mockRejectedValue(new ApiError(500, "server_error"));
    renderPage();
    expect(await screen.findByText("That upload did not go through. Please try again.")).toBeTruthy();
    expect(screen.queryByTestId("upload-warning")).toBeNull();
  });

  it("sends nothing when the scan was cancelled (no file)", async () => {
    vi.mocked(scanContractAsPdfWithQuality).mockResolvedValue({ file: null, quality: null });
    renderPage();
    await vi.waitFor(() => expect(scanContractAsPdfWithQuality).toHaveBeenCalled());
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(uploadContract).not.toHaveBeenCalled();
  });
});
