import { describe, expect, it } from "vitest";
import { formatLimit } from "@/api/contract";

describe("BI_CLIENT_CONTRACT_UPLOAD_v1 limit display", () => {
  it("shows a limit the way a contract writes it", () => {
    expect(formatLimit(5_000_000)).toContain("5,000,000");
    expect(formatLimit(2_000_000)).toContain("2,000,000");
  });

  it("says so plainly when the contract names no amount", () => {
    expect(formatLimit(null)).toBe("no amount stated");
  });

  it("does not round a limit into something friendlier", () => {
    expect(formatLimit(1_500_000)).toContain("1,500,000");
  });
});
