// Drains offline-captured contract uploads on resume, reconnect and start.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, render, screen } from "@testing-library/react";
import { Capacitor } from "@capacitor/core";
import { Network } from "@capacitor/network";
import { drain, readQueue, type QueuedUpload } from "@/upload/queue";
import { useQueueDrain } from "@/upload/useQueueDrain";
import { currentApplicantId } from "@/auth/token";
import { uploadContract } from "@/api/contract";
import App from "@/App";

vi.mock("@/upload/queue", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  readQueue: vi.fn(),
  drain: vi.fn(),
}));
// The real hook, wrapped so a test can see where the app mounts it.
vi.mock("@/upload/useQueueDrain", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/upload/useQueueDrain")>();
  return { useQueueDrain: vi.fn(original.useQueueDrain) };
});
vi.mock("@/api/contract", () => ({ uploadContract: vi.fn() }));

const item: QueuedUpload = {
  id: "Sub.pdf:4:1", documentType: "subcontract", filename: "Sub.pdf", mimeType: "application/pdf",
  dataUrl: "data:application/pdf;base64,JVBERg==", attempts: 0, queuedAt: 1, applicantId: "appl-1",
};

let networkListener: ((status: { connected: boolean }) => void) | null;
let networkHandleRemoved: boolean;
let connected: boolean;
const flush = () => act(async () => { for (let i = 0; i < 10; i += 1) await Promise.resolve(); });

function Drainer({ send, applicant }: { send: (item: QueuedUpload) => Promise<void>; applicant: () => string | null }) {
  useQueueDrain(send, applicant);
  return null;
}

beforeEach(() => {
  connected = true;
  networkListener = null;
  networkHandleRemoved = false;
  vi.spyOn(Capacitor, "isNativePlatform").mockReturnValue(true);
  vi.spyOn(Network, "getStatus").mockImplementation(async () => ({ connected, connectionType: "wifi" }) as never);
  vi.spyOn(Network, "addListener").mockImplementation((async (event: string, listener: (status: { connected: boolean }) => void) => {
    if (event === "networkStatusChange") networkListener = listener;
    return { remove: async () => { networkHandleRemoved = true; } };
  }) as never);
  vi.mocked(readQueue).mockReset().mockResolvedValue([item]);
  vi.mocked(drain).mockReset().mockResolvedValue({ sent: 1, failed: 0, dropped: 0 });
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

async function mount(applicant: () => string | null = () => "appl-1", send = vi.fn(async () => undefined)) {
  const view = render(<Drainer send={send} applicant={applicant} />);
  await flush();
  return { ...view, send };
}

const resume = () => act(() => { window.dispatchEvent(new Event("boreal:native-resume")); });

describe("queue drain on resume", () => {
  it("drains once at start for the signed-in applicant, through the given send", async () => {
    const { send } = await mount();
    expect(drain).toHaveBeenCalledTimes(1);
    const [sendItem, applicantId] = vi.mocked(drain).mock.calls[0];
    expect(applicantId).toBe("appl-1");
    await sendItem(item);
    expect(send).toHaveBeenCalledWith(item);
  });

  it("listens to the event NativeBridge already dispatches, and stops on unmount", async () => {
    const { unmount } = await mount();
    vi.mocked(drain).mockClear();
    resume();
    await flush();
    expect(drain).toHaveBeenCalledTimes(1);

    unmount();
    await flush();
    resume();
    await flush();
    expect(drain).toHaveBeenCalledTimes(1);
    expect(networkHandleRemoved).toBe(true);
  });

  it("guards against a concurrent drain", async () => {
    let finish!: () => void;
    vi.mocked(drain).mockImplementation(() => new Promise((resolve) => { finish = () => resolve({ sent: 1, failed: 0, dropped: 0 }); }));
    await mount();
    expect(drain).toHaveBeenCalledTimes(1);
    resume();
    resume();
    await flush();
    expect(drain).toHaveBeenCalledTimes(1);

    await act(async () => { finish(); });
    await flush();
    resume();
    await flush();
    expect(drain).toHaveBeenCalledTimes(2);
  });

  it("does not attempt with an empty queue", async () => {
    vi.mocked(readQueue).mockResolvedValue([]);
    await mount();
    resume();
    await flush();
    expect(readQueue).toHaveBeenCalled();
    expect(drain).not.toHaveBeenCalled();
  });

  it("does not attempt while offline", async () => {
    connected = false;
    await mount();
    resume();
    await flush();
    expect(Network.getStatus).toHaveBeenCalled();
    expect(drain).not.toHaveBeenCalled();
  });

  it("does not attempt when nobody is signed in", async () => {
    const applicant = vi.fn(() => null);
    await mount(applicant);
    expect(applicant).toHaveBeenCalled();
    expect(drain).not.toHaveBeenCalled();
  });

  it("retries when the network comes back, not only on resume", async () => {
    connected = false;
    await mount();
    expect(drain).not.toHaveBeenCalled();
    expect(networkListener).not.toBeNull();

    act(() => { networkListener!({ connected: false }); });
    await flush();
    expect(drain).not.toHaveBeenCalled();

    connected = true;
    act(() => { networkListener!({ connected: true }); });
    await flush();
    expect(drain).toHaveBeenCalledTimes(1);
    expect(vi.mocked(drain).mock.calls[0][1]).toBe("appl-1");
  });

  it("stays inert on web", async () => {
    vi.mocked(Capacitor.isNativePlatform).mockReturnValue(false);
    await mount();
    resume();
    await flush();
    expect(readQueue).not.toHaveBeenCalled();
    expect(drain).not.toHaveBeenCalled();
    expect(Network.addListener).not.toHaveBeenCalled();
  });

  it("is mounted at the app shell so it runs on any page, uploading for the signed-in applicant", async () => {
    vi.mocked(Capacitor.isNativePlatform).mockReturnValue(false);
    vi.stubGlobal("fetch", vi.fn(async (url: string) => {
      if (url.startsWith("data:")) return { blob: async () => new Blob(["%PDF"], { type: "application/pdf" }) };
      throw new TypeError("Failed to fetch");
    }));
    vi.mocked(uploadContract).mockReset().mockResolvedValue({ applicationId: "app-1", documentId: "d1", requirements: [] });
    render(<App />);
    expect(await screen.findByRole("button", { name: "Send code" })).toBeTruthy();
    expect(useQueueDrain).toHaveBeenCalledWith(expect.any(Function), currentApplicantId);

    // The send the app hands the hook uploads the queued file as a contract.
    const [send] = vi.mocked(useQueueDrain).mock.calls[0];
    await send(item);
    expect(uploadContract).toHaveBeenCalledTimes(1);
    const file = vi.mocked(uploadContract).mock.calls[0][0];
    expect(file.name).toBe("Sub.pdf");
    expect(file.type).toBe("application/pdf");
  });
});
