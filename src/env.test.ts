import { describe, expect, it } from "vitest";
import { ENV } from "@/env";

describe("BI_CLIENT_SCAFFOLD_v1 environment", () => {
  it("targets bi-server's /api/v1 prefix, not BF-Server's /api", () => {
    expect(ENV.API_PREFIX).toBe("/api/v1");
  });
  it("carries no trailing slash, so path joining cannot double up", () => {
    expect(ENV.API_BASE.endsWith("/")).toBe(false);
  });
});
