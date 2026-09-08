// BI_CLIENT_BLOCK_v094_WIRE_UPLOAD_QUEUE_v1
import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

const page = fs.readFileSync(path.resolve(__dirname, "./UploadContractPage.tsx"), "utf8");

describe("upload page uses the queue and quality modules", () => {
  it("enqueues instead of discarding when offline", () => {
    // The old branch threw "offline" and lost the captured document.
    expect(page).toContain("await enqueue(");
    expect(page).toContain('throw new Error("queued")');
    expect(page).toContain("will send it automatically");
  });

  it("drains stranded uploads after a successful send", () => {
    const sendIndex = page.indexOf("const result = await uploadContract(file)");
    expect(sendIndex).toBeGreaterThan(-1);
    expect(page.indexOf("void drain(")).toBeGreaterThan(sendIndex);
  });

  it("warns on poor capture quality without blocking the upload", () => {
    expect(page).toContain("await assessImage(file)");
    expect(page).toContain("setWarning(");
    // No throw or early return on a quality issue.
    expect(page).not.toMatch(/quality[\s\S]{0,120}throw new Error/);
  });

  it("keeps the queue id stable for the same file", () => {
    expect(page).toContain("${file.name}:${file.size}:${file.lastModified}");
  });
});
