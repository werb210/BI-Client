// BI_CLIENT_v791 - behaviour tests for the upload page: a poor scan is warned
// about before anything is sent or the page moves on, and a file the local
// check rejects says why.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { Capacitor } from "@capacitor/core";
import type { QualityReport } from "@/upload/quality";
import { uploadContract } from "@/api/contract";
import { scanContractAsPdfWithQuality } from "@/native/documentScanner";
import UploadContractPage from "@/pages/UploadContractPage";

vi.mock("@capacitor-mlkit/document-scanner", () => ({ DocumentScanner: { scanDocument: vi.fn() } }));
vi.mock("@/native/documentScanner", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  scanContractAsPdfWithQuality: vi.fn(),
}));
vi.mock("@/api/contract", () => ({ uploadContract: vi.fn() }));

const blurry: QualityReport = { ok: false, issues: ["too_blurry"], sharpness: 12, width: 1200, height: 1600 };
const scanned = (name = "contract-scan.pdf") => new File(["%PDF-1.4"], name, { type: "application/pdf" });

function renderPage() {
  render(
    <MemoryRouter initialEntries={["/upload"]}>
      <Routes>
        <Route path="/upload" element={<UploadContractPage />} />
        <Route path="/requirements/:applicationId" element={<h1>Requirements screen</h1>} />
      </Routes>
    </MemoryRouter>,
  );
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.mocked(uploadContract).mockReset();
  vi.mocked(scanContractAsPdfWithQuality).mockReset();
});

describe("a poor scan is flagged before the page moves on", () => {
  beforeEach(() => {
    vi.spyOn(Capacitor, "isNativePlatform").mockReturnValue(true);
  });

  it("shows the warning and waits, sending nothing until the applicant chooses", async () => {
    vi.mocked(scanContractAsPdfWithQuality).mockResolvedValue({ file: scanned(), quality: blurry });
    vi.mocked(uploadContract).mockResolvedValue({ applicationId: "app-1", documentId: "d1", requirements: [] });
    renderPage();
    fireEvent.click(screen.getByRole("button", { name: "Scan Document" }));

    const warning = await screen.findByTestId("upload-warning");
    expect(warning.textContent).toBe("Scanned page: This looks blurry. Hold steady and try again in better light.");
    expect(screen.getByRole("button", { name: "Upload anyway" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Retake" })).toBeTruthy();
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(uploadContract).not.toHaveBeenCalled();
    expect(screen.queryByRole("heading", { name: "Requirements screen" })).toBeNull();
  });

  it("sends the scan and moves on after Upload anyway", async () => {
    const file = scanned();
    vi.mocked(scanContractAsPdfWithQuality).mockResolvedValue({ file, quality: blurry });
    vi.mocked(uploadContract).mockResolvedValue({ applicationId: "app-2", documentId: "d1", requirements: [] });
    renderPage();
    fireEvent.click(screen.getByRole("button", { name: "Scan Document" }));
    fireEvent.click(await screen.findByRole("button", { name: "Upload anyway" }));
    expect(await screen.findByRole("heading", { name: "Requirements screen" })).toBeTruthy();
    expect(uploadContract).toHaveBeenCalledTimes(1);
    expect(uploadContract).toHaveBeenCalledWith(file);
  });

  it("discards the poor scan and scans again on Retake", async () => {
    const poor = scanned("poor.pdf");
    const good = scanned("good.pdf");
    vi.mocked(scanContractAsPdfWithQuality)
      .mockResolvedValueOnce({ file: poor, quality: blurry })
      .mockResolvedValueOnce({ file: good, quality: null });
    vi.mocked(uploadContract).mockResolvedValue({ applicationId: "app-3", documentId: "d1", requirements: [] });
    renderPage();
    fireEvent.click(screen.getByRole("button", { name: "Scan Document" }));
    fireEvent.click(await screen.findByRole("button", { name: "Retake" }));
    expect(await screen.findByRole("heading", { name: "Requirements screen" })).toBeTruthy();
    expect(scanContractAsPdfWithQuality).toHaveBeenCalledTimes(2);
    expect(uploadContract).toHaveBeenCalledTimes(1);
    expect(uploadContract).toHaveBeenCalledWith(good);
  });

  it("goes straight on after a good scan", async () => {
    vi.mocked(scanContractAsPdfWithQuality).mockResolvedValue({ file: scanned(), quality: null });
    vi.mocked(uploadContract).mockResolvedValue({ applicationId: "app-4", documentId: "d1", requirements: [] });
    renderPage();
    fireEvent.click(screen.getByRole("button", { name: "Scan Document" }));
    expect(await screen.findByRole("heading", { name: "Requirements screen" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Upload anyway" })).toBeNull();
  });
});

describe("a file the local check rejects says why", () => {
  beforeEach(() => {
    vi.spyOn(Capacitor, "isNativePlatform").mockReturnValue(false);
  });
  const pick = (file: File) =>
    fireEvent.change(screen.getByTestId("contract-file-input"), { target: { files: [file] } });

  it("names the supported types for a wrong file type", async () => {
    renderPage();
    pick(new File(["GIF89a"], "contract.gif", { type: "image/gif" }));
    expect(await screen.findByText("That file type isn't supported. Use PDF, Word, JPG or PNG.")).toBeTruthy();
    expect(screen.queryByText("That upload did not go through. Please try again.")).toBeNull();
    expect(uploadContract).not.toHaveBeenCalled();
  });

  it("names the size limit for a file over 25 MB", async () => {
    renderPage();
    const big = new File(["%PDF-1.4"], "contract.pdf", { type: "application/pdf" });
    Object.defineProperty(big, "size", { value: 25 * 1024 * 1024 + 1 });
    pick(big);
    expect(await screen.findByText("That file is over 25 MB. Please choose a smaller file.")).toBeTruthy();
    expect(screen.queryByText("That upload did not go through. Please try again.")).toBeNull();
    expect(uploadContract).not.toHaveBeenCalled();
  });
});
