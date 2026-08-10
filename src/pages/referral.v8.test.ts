// BI_CLIENT_REFERRAL_v8
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

const read = (relativePath: string) =>
  readFileSync(path.join(process.cwd(), relativePath), "utf8");
const requirements = read("src/pages/RequirementsPage.tsx");
const review = read("src/pages/ReviewPage.tsx");
const contractApi = read("src/api/contract.ts");
const summaryApi = read("src/api/summary.ts");

describe("an unplaceable requirement says so before it is confirmed", () => {
  it("shows a notice naming the country", () => {
    expect(requirements).toContain("req.available === false &&");
    expect(requirements).toContain("We cannot place this one in {country} ourselves.");
  });

  it("resolves the real country rather than guessing", () => {
    expect(requirements).toContain('sel.country === "US" ? "the United States" : "Canada"');
    expect(requirements).toContain('useState("your country")');
  });

  it("does not claim it was simply Confirmed afterwards", () => {
    expect(requirements).toContain("Confirmed. We will refer this one out and come back to you.");
  });

  it("still lets the applicant confirm, because that is the demand signal", () => {
    expect(requirements).toContain("Yes, that is right");
  });
});

describe("review separates referrals from quoted coverage", () => {
  it("gives them their own block, not the coverage list", () => {
    expect(review).toContain("Being referred out ({s.referrals.length})");
    expect(review).toContain("s.referrals.map((r) =>");
  });

  it("explains what happens next", () => {
    expect(review).toContain("Our team will find you a market and come back to you.");
  });

  it("repeats them on the confirmation screen", () => {
    expect((review.match(/Being referred out/g) || []).length).toBe(2);
  });

  it("does not block submission", () => {
    expect(review).not.toContain("referrals.length > 0 && disabled");
  });
});

describe("types carry the new fields", () => {
  it("Requirement has availability", () => {
    expect(contractApi).toContain("available?: boolean;");
  });

  it("Summary has referrals", () => {
    expect(summaryApi).toContain("referrals: Referral[];");
    expect(summaryApi).toContain("requested_limit: string | null;");
  });
});
