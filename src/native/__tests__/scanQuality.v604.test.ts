// BI_CLIENT_BLOCK_v604_SCAN_QUALITY
import { describe, it, expect, vi } from "vitest";
import { readFileSync } from "node:fs";
vi.mock("@capacitor-mlkit/document-scanner", () => ({ DocumentScanner: { scanDocument: vi.fn() } }));
import { worstPage } from "../documentScanner";

const r = (issues: any[], sharpness: number) => ({ ok: issues.length === 0, issues, sharpness, width: 1200, height: 1600 });

describe("scanned contract quality", () => {
  it("reports the worst page and ignores good or unmeasured pages", () => {
    expect(worstPage([r([], 90), null])).toBeNull();
    expect(worstPage([r(["too_blurry"], 30), r(["too_blurry", "too_small"], 40), r([], 99)])?.issues).toEqual(["too_blurry", "too_small"]);
    expect(worstPage([r(["too_blurry"], 30), r(["too_blurry"], 10)])?.sharpness).toBe(10);
  });

  it("the upload page warns after a poor scan and still uploads it", () => {
    const page = readFileSync("src/pages/UploadContractPage.tsx", "utf8");
    expect(page).toContain("scanContractAsPdfWithQuality()");
    expect(page).toContain("if (file) await send(file);");
    expect(page).toContain("Scanned page:");
  });
});
