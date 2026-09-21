// BI_CLIENT_SIGNED_IN_DESTINATION_v368
import { describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({ get: vi.fn(), deepLink: null as string | null }));
vi.mock("@/api/client", () => ({ api: { get: (...a: unknown[]) => h.get(...a) } }));
vi.mock("@/native/deepLinks", () => ({ consumeNativeDestination: () => h.deepLink }));

import { destinationFor, signedInDestination } from "../signedInDestination";

const steps = (first: string) => ({ steps: [{ key: "application", state: first }, { key: "documents", state: "upcoming" }] });

describe("a signed-in applicant lands in the right place", () => {
  it("a submitted application goes to the status page", () => {
    expect(destinationFor(steps("done"))).toBe("/home");
  });
  it("an unfinished, cancelled or missing application goes to Step 1", () => {
    expect(destinationFor(steps("current"))).toBe("/start");
    expect(destinationFor(steps("stopped"))).toBe("/start");
    expect(destinationFor(null)).toBe("/start");
  });
  it("asks the server, and falls back to Step 1 if it cannot", async () => {
    h.deepLink = null;
    h.get.mockResolvedValueOnce({ progress: steps("done") });
    expect(await signedInDestination()).toBe("/home");
    expect(h.get).toHaveBeenLastCalledWith("/applicants/me/progress");
    h.get.mockRejectedValueOnce(new Error("offline"));
    expect(await signedInDestination()).toBe("/start");
  });
  it("a notification deep link still wins", async () => {
    h.deepLink = "/requirements/abc";
    expect(await signedInDestination()).toBe("/requirements/abc");
  });
});
