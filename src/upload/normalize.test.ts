import { describe, expect, it } from "vitest";
import { MAX_UPLOAD_BYTES, normalizeBrowserFile, validateUpload } from "./normalize";

describe("upload normalization", () => {
  it("preserves browser files", () => { const f = new File(["pdf"], "contract.pdf", { type: "application/pdf" }); expect(normalizeBrowserFile(f)).toBe(f); });
  it.each([["contract.pdf", "application/pdf"], ["photo.jpg", "image/jpeg"]])("accepts %s", (name, type) => { const f = new File(["x"], name, { type }); expect(normalizeBrowserFile(f).type).toBe(type); });
  it("rejects large and unsupported files", () => {
    expect(() => validateUpload({ name: "huge.pdf", size: MAX_UPLOAD_BYTES + 1 })).toThrow("file_too_large");
    expect(() => validateUpload({ name: "script.exe", size: 2 })).toThrow("unsupported_file_type");
  });
});
