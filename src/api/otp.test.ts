import { describe, expect, it } from "vitest";
import { toE164 } from "@/api/otp";

describe("BI_CLIENT_SCAFFOLD_v1 phone normalisation", () => {
  it("adds the country code to a bare ten-digit number", () => {
    expect(toE164("5875551234")).toBe("+15875551234");
    expect(toE164("(587) 555-1234")).toBe("+15875551234");
  });
  it("prefixes an eleven-digit number that already starts with 1", () => {
    expect(toE164("15875551234")).toBe("+15875551234");
  });
  it("leaves an already-normalised number alone", () => {
    expect(toE164("+15875551234")).toBe("+15875551234");
  });
  it("does not mangle something it cannot interpret", () => {
    expect(toE164("  not a number  ")).toBe("not a number");
  });
});
