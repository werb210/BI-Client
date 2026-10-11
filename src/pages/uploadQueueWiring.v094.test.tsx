// BI_CLIENT_BLOCK_v094 - the upload page keeps an offline capture in the
// (real, sealed) upload queue, drains it after the next successful send, and
// treats a poor-quality photo as a warning, not a blocker.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { liveJwt } from "@/test-utils/pages2-helpers";

const env = vi.hoisted(() => ({ native: true, online: true, prefs: new Map<string, string>() }));
const uploadContract = vi.hoisted(() => vi.fn());
const assessImage = vi.hoisted(() => vi.fn());

// Every @capacitor/* package is one module in tests, so all overrides live here.
vi.mock("@capacitor/core", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/test-capacitor-mock")>();
  return {
    ...original,
    Capacitor: { ...original.Capacitor, isNativePlatform: () => env.native, getPlatform: () => (env.native ? "ios" : "web") },
    Network: { ...original.Network, getStatus: async () => ({ connected: env.online }) },
    Preferences: {
      ...original.Preferences,
      get: async ({ key }: { key: string }) => ({ value: env.prefs.get(key) ?? null }),
      set: async ({ key, value }: { key: string; value: string }) => { env.prefs.set(key, value); },
      remove: async ({ key }: { key: string }) => { env.prefs.delete(key); },
    },
  };
});
vi.mock("@/api/contract", async (importOriginal) => ({ ...(await importOriginal<object>()), uploadContract }));
vi.mock("@/upload/quality", async (importOriginal) => ({ ...(await importOriginal<object>()), assessImage }));
vi.mock("@/upload/queue", async (importOriginal) => {
  const real = await importOriginal<typeof import("@/upload/queue")>();
  return { ...real, enqueue: vi.fn(real.enqueue), drain: vi.fn(real.drain) };
});

import UploadContractPage from "@/pages/UploadContractPage";
import { clearQueue, drain, enqueue, readQueue } from "@/upload/queue";
import { ISSUE_MESSAGES } from "@/upload/quality";
import { setToken } from "@/auth/token";

const APPLICANT = "applicant-42";

function renderPage() {
  return render(
    <MemoryRouter initialEntries={["/upload"]}>
      <Routes>
        <Route path="/upload" element={<UploadContractPage />} />
        <Route path="/requirements/:id" element={<h1>Requirements screen</h1>} />
      </Routes>
    </MemoryRouter>,
  );
}

function pick(file: File) {
  fireEvent.change(screen.getByTestId("contract-file-input"), { target: { files: [file] } });
}

const photo = (name = "contract.jpg", body = "jpeg-bytes", lastModified = 1_700_000_000_000) =>
  new File([body], name, { type: "image/jpeg", lastModified });

/** jsdom's File has no text(); FileReader reads it. */
function readText(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsText(blob);
  });
}

/** Decodes a data: URL with jsdom's Blob so the page's fetch(item.dataUrl) works. */
const fetchDataUrl = vi.fn(async (url: string) => {
  const [head, data] = url.split(",");
  return { blob: async () => new Blob([atob(data)], { type: head.slice(5).split(";")[0] }) };
});

beforeEach(async () => {
  env.native = true;
  env.online = true;
  env.prefs.clear();
  await clearQueue();
  vi.mocked(enqueue).mockClear();
  vi.mocked(drain).mockClear();
  uploadContract.mockReset();
  assessImage.mockReset();
  assessImage.mockResolvedValue(null);
  fetchDataUrl.mockClear();
  vi.stubGlobal("fetch", fetchDataUrl);
  await setToken(liveJwt({ sub: APPLICANT }));
});

afterEach(() => { vi.unstubAllGlobals(); });

describe("upload page uses the queue and quality modules", () => {
  it("enqueues instead of discarding when offline", async () => {
    env.online = false;
    renderPage();
    const file = photo();
    pick(file);
    expect(await screen.findByText(/will send it automatically/)).toBeTruthy();
    expect(screen.getByText(/You're offline\. We've saved this document/)).toBeTruthy();
    expect(uploadContract).not.toHaveBeenCalled();

    const queued = await readQueue();
    expect(queued).toHaveLength(1);
    expect(queued[0]).toMatchObject({
      documentType: "subcontract",
      filename: "contract.jpg",
      mimeType: "image/jpeg",
      applicantId: APPLICANT,
    });
    // The captured bytes are kept, not thrown away.
    expect(atob(queued[0].dataUrl.split(",")[1])).toBe("jpeg-bytes");
    // Nothing navigates away: the applicant stays on the upload page.
    expect(screen.queryByRole("heading", { name: "Requirements screen" })).toBeNull();
  });

  it("drains stranded uploads after a successful send", async () => {
    // An earlier outage left a capture in the queue.
    env.online = false;
    renderPage();
    pick(photo("stranded.jpg", "stranded-bytes"));
    await screen.findByText(/will send it automatically/);
    expect(await readQueue()).toHaveLength(1);

    // Back online: the next pick uploads, then the queue is drained for this applicant.
    env.online = true;
    uploadContract.mockResolvedValue({ applicationId: "app-9" });
    pick(photo("fresh.jpg", "fresh-bytes", 1_700_000_000_500));
    expect(await screen.findByRole("heading", { name: "Requirements screen" })).toBeTruthy();

    expect(vi.mocked(drain)).toHaveBeenCalledTimes(1);
    expect(vi.mocked(drain).mock.calls[0][1]).toBe(APPLICANT);
    expect(uploadContract.mock.invocationCallOrder[0]).toBeLessThan(vi.mocked(drain).mock.invocationCallOrder[0]);
    await waitFor(() => expect(uploadContract).toHaveBeenCalledTimes(2));
    expect((uploadContract.mock.calls[0][0] as File).name).toBe("fresh.jpg");
    const resent = uploadContract.mock.calls[1][0] as File;
    expect(resent.name).toBe("stranded.jpg");
    expect(resent.type).toBe("image/jpeg");
    expect(await readText(resent)).toBe("stranded-bytes");
    expect(fetchDataUrl.mock.calls[0][0]).toMatch(/^data:image\/jpeg;base64,/);
    await waitFor(async () => expect(await readQueue()).toEqual([]));
  });

  it("does not drain when the upload itself fails", async () => {
    uploadContract.mockRejectedValue(new Error("boom"));
    renderPage();
    pick(photo());
    expect(await screen.findByText("That upload did not go through. Please try again.")).toBeTruthy();
    expect(vi.mocked(drain)).not.toHaveBeenCalled();
  });

  it("warns on poor capture quality without blocking the upload", async () => {
    assessImage.mockResolvedValue({ ok: false, issues: ["too_blurry", "too_small"], sharpness: 10, width: 400, height: 300 });
    let finish: (value: unknown) => void = () => undefined;
    uploadContract.mockImplementation(() => new Promise((resolve) => { finish = resolve; }));
    renderPage();
    const file = photo();
    pick(file);

    const warning = await screen.findByTestId("upload-warning");
    expect(warning.textContent).toBe(`${ISSUE_MESSAGES.too_blurry} ${ISSUE_MESSAGES.too_small}`);
    expect(assessImage).toHaveBeenCalledWith(file);
    // The poor photo still goes up.
    await waitFor(() => expect(uploadContract).toHaveBeenCalledWith(file));
    finish({ applicationId: "app-3" });
    expect(await screen.findByRole("heading", { name: "Requirements screen" })).toBeTruthy();
  });

  it("keeps the queue id stable for the same file", async () => {
    env.online = false;
    renderPage();
    const file = photo("same.jpg", "same-bytes", 1_700_000_123_000);
    pick(file);
    await screen.findByText(/will send it automatically/);
    pick(file);
    await waitFor(() => expect(vi.mocked(enqueue)).toHaveBeenCalledTimes(2));
    const ids = vi.mocked(enqueue).mock.calls.map(([item]) => item.id);
    expect(ids[0]).toBe(`same.jpg:${file.size}:1700000123000`);
    expect(ids[1]).toBe(ids[0]);
    // The same capture is kept once, not twice.
    expect(await readQueue()).toHaveLength(1);
  });
});
