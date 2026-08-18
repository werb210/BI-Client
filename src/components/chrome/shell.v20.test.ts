// BI_CLIENT_SHELL_v20 - Upload and Requirements take the shell but not the
// outer card: both compose their own panels.
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

const read = (p: string) => readFileSync(path.join(process.cwd(), p), "utf8");

const UPLOAD = read("src/pages/UploadContractPage.tsx");
const REQS = read("src/pages/RequirementsPage.tsx");

describe("both pages use the shell", () => {
  for (const [name, src] of [["UploadContractPage", UPLOAD], ["RequirementsPage", REQS]] as const) {
    it(`${name} sits on the mist page ground`, () => {
      expect(src).toContain('className="bi-page"');
      expect(src).toContain('className="bi-page__inner"');
    });

    it(`${name} no longer sets its own width`, () => {
      expect(src).not.toContain("maxWidth: 560");
      expect(src).not.toContain("maxWidth: 620");
    });

    it(`${name} uses the shell type scale`, () => {
      expect(src).toContain("<h1>");
      expect(src).not.toContain('<h1 style={{ fontSize: 22');
    });
  }
});

describe("panels are not nested in a card", () => {
  it("Requirements keeps its per-item cards without an outer one", () => {
    expect(REQS).not.toContain('className="bi-card"');
    expect(REQS).toContain("const card: React.CSSProperties");
  });

  it("Upload keeps its dashed dropzone on mist", () => {
    expect(UPLOAD).not.toContain('className="bi-card"');
    expect(UPLOAD).toContain("2px dashed");
  });
});
