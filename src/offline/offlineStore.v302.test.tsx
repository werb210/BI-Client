// BI_CLIENT_OFFLINE_v302
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { Network } from "@capacitor/network";
import {
  cacheResponse,
  cachedResponse,
  clearOfflineData,
  drainOutbox,
  enqueueSave,
  isNetworkError,
  isQueueable,
  OFFLINE_COPY,
  OfflineQueuedError,
  readOutbox,
} from "./offlineStore";
import { bannerText } from "./OfflineBanner";
import { ApiError, apiRequest } from "@/api/client";
import { clearToken, setToken } from "@/auth/token";
import App from "@/App";
import QuestionsPage from "@/pages/QuestionsPage";
import ReviewPage from "@/pages/ReviewPage";

beforeEach(() => { localStorage.clear(); });
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("what is kept offline", () => {
  it("queues answer, coverage and requirement saves only", () => {
    expect(isQueueable("POST", "/applicants/applications/a1/answers")).toBe(true);
    expect(isQueueable("POST", "/applicants/applications/a1/products")).toBe(true);
    expect(isQueueable("POST", "/applicants/applications/a1/requirements/r1/confirm")).toBe(true);
    expect(isQueueable("POST", "/applicants/applications/a1/submit")).toBe(false);
    expect(isQueueable("POST", "/applicants/otp/verify")).toBe(false);
    expect(isQueueable("GET", "/applicants/applications/a1/answers")).toBe(false);
  });
  it("recognises a dropped connection", () => {
    expect(isNetworkError(new TypeError("Failed to fetch"))).toBe(true);
    expect(isNetworkError(new Error("Load failed"))).toBe(true);
    expect(isNetworkError(new Error("invalid_otp"))).toBe(false);
  });
});

describe("outbox", () => {
  it("keeps only the newest save for the same place, and sends in order", async () => {
    await enqueueSave("/applicants/applications/a1/products", '{"codes":["A"]}');
    await enqueueSave("/applicants/applications/a1/answers", '{"answers":[]}');
    await enqueueSave("/applicants/applications/a1/products", '{"codes":["A","B"]}');
    const items = await readOutbox();
    expect(items.map((i) => i.body)).toEqual(['{"answers":[]}', '{"codes":["A","B"]}']);
    const sent: string[] = [];
    expect(await drainOutbox(async (i) => { sent.push(i.path); })).toEqual({ sent: 2, left: 0 });
    expect(sent).toEqual(["/applicants/applications/a1/answers", "/applicants/applications/a1/products"]);
  });
  it("stops while still offline and drops a save the server rejects", async () => {
    await enqueueSave("/applicants/applications/a1/answers", "{}");
    await enqueueSave("/applicants/applications/a1/products", "{}");
    expect(await drainOutbox(async () => { throw new TypeError("Failed to fetch"); })).toEqual({ sent: 0, left: 2 });
    const send = vi.fn().mockRejectedValueOnce(Object.assign(new Error("bad"), { status: 400 })).mockResolvedValueOnce(undefined);
    expect(await drainOutbox(send)).toEqual({ sent: 1, left: 0 });
  });
});

describe("read cache", () => {
  it("returns the last copy and clears everything on sign-out", async () => {
    await cacheResponse("/applicants/me/progress", { progress: { headline: "x" } });
    expect(await cachedResponse("/applicants/me/progress")).toEqual({ progress: { headline: "x" } });
    await enqueueSave("/applicants/applications/a1/answers", "{}");
    await clearOfflineData();
    expect(await cachedResponse("/applicants/me/progress")).toBeUndefined();
    expect(await readOutbox()).toEqual([]);
  });
});

// --- wiring -----------------------------------------------------------------

const offline = () => vi.fn(async (_url: string, _init?: RequestInit): Promise<any> => { throw new TypeError("Failed to fetch"); });
const ok = (body: unknown) => ({ ok: true, status: 200, text: async () => JSON.stringify(body) });

describe("banner and wiring", () => {
  it("explains offline and waiting changes", () => {
    expect(bannerText(false, 2)).toBe("You're offline. 2 changes are saved on this phone and will send when you reconnect.");
    expect(bannerText(true, 1)).toBe("Sending 1 saved change\u2026");
    expect(bannerText(true, 0)).toBeNull();
  });

  describe("the API client", () => {
    it("keeps a save made offline and throws OfflineQueuedError", async () => {
      vi.stubGlobal("fetch", offline());
      const body = JSON.stringify({ answers: [{ questionKey: "q1", value: "yes" }] });
      await expect(apiRequest("/applicants/applications/a1/answers", { method: "POST", body })).rejects.toBeInstanceOf(OfflineQueuedError);
      expect((await readOutbox()).map((i) => [i.path, i.body])).toEqual([["/applicants/applications/a1/answers", body]]);
    });

    it("does not keep a submit made offline: it fails as offline", async () => {
      vi.stubGlobal("fetch", offline());
      const err = await apiRequest("/applicants/applications/a1/submit", { method: "POST", body: "{}" }).catch((e: unknown) => e);
      expect(err).toBeInstanceOf(ApiError);
      expect((err as ApiError).code).toBe("offline");
      expect(await readOutbox()).toEqual([]);
    });

    it("shows the last copy of a screen when the connection drops", async () => {
      vi.stubGlobal("fetch", vi.fn(async () => ok({ progress: { headline: "Two steps left" } })));
      expect(await apiRequest("/applicants/me/progress")).toEqual({ progress: { headline: "Two steps left" } });
      await waitFor(async () => expect(await cachedResponse("/applicants/me/progress")).toBeDefined());

      vi.stubGlobal("fetch", offline());
      const copy = vi.fn();
      window.addEventListener(OFFLINE_COPY, copy);
      try {
        expect(await apiRequest("/applicants/me/progress")).toEqual({ progress: { headline: "Two steps left" } });
      } finally {
        window.removeEventListener(OFFLINE_COPY, copy);
      }
      expect(copy).toHaveBeenCalledTimes(1);
    });

    it("keeps no copy of a screen that is not on the offline list", async () => {
      vi.stubGlobal("fetch", vi.fn(async () => ok({ messages: ["hello"] })));
      await apiRequest("/applicants/messages");
      vi.stubGlobal("fetch", offline());
      await expect(apiRequest("/applicants/messages")).rejects.toMatchObject({ code: "offline" });
      expect(await cachedResponse("/applicants/messages")).toBeUndefined();
    });
  });

  it("the app shows the offline banner and sends waiting saves when the connection returns", async () => {
    await enqueueSave("/applicants/applications/a1/answers", "{}");
    await enqueueSave("/applicants/applications/a1/products", "{}");
    const fetchMock = offline();
    vi.stubGlobal("fetch", fetchMock);
    vi.spyOn(Network, "getStatus").mockResolvedValue({ connected: false } as never);
    render(<App />);
    const banner = await screen.findByTestId("offline-banner");
    expect(banner.textContent).toBe("You're offline. 2 changes are saved on this phone and will send when you reconnect.");
    expect(await readOutbox()).toHaveLength(2);

    fetchMock.mockClear();
    fetchMock.mockImplementation(async () => ok({}));
    act(() => { window.dispatchEvent(new Event("online")); });
    await waitFor(() => expect(screen.queryByTestId("offline-banner")).toBeNull());
    expect(await readOutbox()).toEqual([]);
    const posted = fetchMock.mock.calls.filter(([, init]) => init?.method === "POST").map(([url]) => String(url));
    expect(posted).toEqual([
      expect.stringMatching(/\/applicants\/applications\/a1\/answers$/),
      expect.stringMatching(/\/applicants\/applications\/a1\/products$/),
    ]);
  });

  it("the questions page tells the applicant an offline save is kept on the phone", async () => {
    vi.stubGlobal("fetch", vi.fn(async (url: string, init?: RequestInit) => {
      if ((init?.method ?? "GET") === "GET" && url.endsWith("/applicants/applications/a1/questions")) {
        return ok({
          applicationId: "a1", country: "CA",
          questions: [{
            questionKey: "q1", prompt: "Do you have employees?", helpText: null, inputType: "yes_no", group: "business",
            adverseAnswer: null, required: true, dependsOnKey: null, dependsOnValue: null, sortOrder: 1, askedBy: [],
            value: null, reason: null, options: null, minValue: null, maxValue: null, placeholder: null,
          }],
        });
      }
      throw new TypeError("Failed to fetch");
    }));
    render(
      <MemoryRouter initialEntries={["/questions/a1"]}>
        <Routes><Route path="/questions/:applicationId" element={<QuestionsPage />} /></Routes>
      </MemoryRouter>,
    );
    fireEvent.click(await screen.findByRole("button", { name: "Yes" }));
    fireEvent.click(screen.getByRole("button", { name: "Finish" }));
    expect(await screen.findByText("You're offline. This is saved on your phone and will be sent automatically when you're back online.")).toBeTruthy();
    const kept = await readOutbox();
    expect(kept.map((i) => i.path)).toEqual(["/applicants/applications/a1/answers"]);
    expect(JSON.parse(kept[0].body)).toEqual({ answers: [{ questionKey: "q1", value: "yes", reason: null }] });
  });

  it("the review page says submitting needs a connection", async () => {
    vi.stubGlobal("fetch", vi.fn(async (url: string, init?: RequestInit) => {
      if ((init?.method ?? "GET") === "GET" && url.endsWith("/applicants/applications/a1/summary")) {
        return ok({
          applicationId: "a1", status: "in_progress", country: "CA", businessName: "Acme", applicantName: "Ann", email: "a@x.test",
          coverages: [], documents: [], answered: 3, outstanding: [], referrals: [], canSubmit: true,
        });
      }
      throw new TypeError("Failed to fetch");
    }));
    render(
      <MemoryRouter initialEntries={["/review/a1"]}>
        <Routes><Route path="/review/:applicationId" element={<ReviewPage />} /></Routes>
      </MemoryRouter>,
    );
    fireEvent.click(await screen.findByRole("button", { name: "Submit my application" }));
    expect(await screen.findByText("You're offline. Connect to the internet to submit your application.")).toBeTruthy();
    expect(await readOutbox()).toEqual([]);
  });

  it("sign-out removes cached screens and unsent saves from the phone", async () => {
    await setToken("tok");
    await cacheResponse("/applicants/me/progress", { progress: { headline: "x" } });
    await cacheResponse("/applicants/applications/a1/summary", { applicationId: "a1" });
    await enqueueSave("/applicants/applications/a1/answers", "{}");
    localStorage.setItem("boreal_bi_offline_cache:/applicants/industries", "bi-enc1:stray");
    const offlineKeys = () => Object.keys(localStorage).filter((k) => k.startsWith("boreal_bi_offline_cache") || k === "boreal_bi_outbox");
    expect(offlineKeys().length).toBeGreaterThanOrEqual(4);
    // Kept sealed, never as plaintext.
    for (const key of offlineKeys()) expect(localStorage.getItem(key)).toMatch(/^bi-enc1:/);

    await clearToken();
    await waitFor(() => expect(offlineKeys()).toEqual([]));
    expect(await cachedResponse("/applicants/me/progress")).toBeUndefined();
    expect(await readOutbox()).toEqual([]);
  });
});
