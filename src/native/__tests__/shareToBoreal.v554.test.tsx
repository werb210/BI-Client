// BI_CLIENT_BLOCK_v554_SHARE_TO_BOREAL
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { Capacitor } from "@capacitor/core";
import { fileNameFromUrl, holdSharedUrl, isSharedFileUrl, mimeFor, takeShared } from "../sharedFiles";
import { consumeNativeDestination } from "../deepLinks";
import { restoreToken, setToken } from "@/auth/token";
import { uploadContract } from "@/api/contract";
import NativeBridge from "../NativeBridge";
import UploadContractPage from "@/pages/UploadContractPage";

const native = vi.hoisted(() => ({ current: null as ReturnType<typeof import("./native2-nativeApp").createNativeApp> | null }));

vi.mock("@capacitor/core", async (importOriginal) => {
  const original = await importOriginal<Record<string, unknown>>();
  const { createNativeApp: make } = await import("./native2-nativeApp");
  native.current = make();
  return { ...original, App: native.current.app };
});
vi.mock("../pushNotifications", () => ({ initializePushNotifications: vi.fn(async () => []) }));
vi.mock("@/api/contract", () => ({ uploadContract: vi.fn() }));

describe("v554 share a subcontract to Boreal Risk", () => {
  it("tells a shared file from a deep link", () => {
    expect(isSharedFileUrl("file:///var/mobile/Inbox/Subcontract%20A.pdf")).toBe(true);
    expect(isSharedFileUrl("content://com.android.providers/1")).toBe(true);
    expect(isSharedFileUrl("borealrisk://upload")).toBe(false);
  });
  it("holds the file with its name and type until the upload page takes it", () => {
    holdSharedUrl("file:///x/Inbox/Subcontract%20A.pdf");
    expect(takeShared()).toEqual({ path: "file:///x/Inbox/Subcontract%20A.pdf", name: "Subcontract A.pdf", mimeType: "application/pdf" });
    expect(takeShared()).toBeNull();
    expect(fileNameFromUrl("not a url")).toBe("contract");
    expect(mimeFor("scan", "image/jpeg")).toBe("image/jpeg");
  });
});

function Where() {
  return <p data-testid="where">{useLocation().pathname}</p>;
}

describe("shared files open the upload page, after sign-in if needed", () => {
  let os: NonNullable<typeof native.current>;

  beforeEach(async () => {
    os = native.current!;
    os.app.getLaunchUrl.mockReset().mockResolvedValue(undefined);
    os.app.addListener.mockClear();
    vi.spyOn(Capacitor, "isNativePlatform").mockReturnValue(true);
    await restoreToken(); // secure storage is empty: nobody is signed in
    consumeNativeDestination();
    while (takeShared()) { /* drain anything left over */ }
  });
  afterEach(() => { vi.restoreAllMocks(); });

  async function mountBridge(path = "/home") {
    render(
      <MemoryRouter initialEntries={[path]}>
        <NativeBridge />
        <Where />
      </MemoryRouter>,
    );
    await waitFor(() => expect(os.has("appUrlOpen")).toBe(true));
  }

  it("a signed-in applicant who shares a file lands on the upload page with the file waiting", async () => {
    await setToken("token-1");
    await mountBridge();
    await act(async () => { await os.fire("appUrlOpen", { url: "file:///var/mobile/Inbox/Subcontract%20A.pdf" }); });
    expect(screen.getByTestId("where").textContent).toBe("/upload");
    expect(takeShared()).toEqual({ path: "file:///var/mobile/Inbox/Subcontract%20A.pdf", name: "Subcontract A.pdf", mimeType: "application/pdf" });
  });

  it("a signed-out applicant signs in first and is then sent to the upload page", async () => {
    await mountBridge();
    await act(async () => { await os.fire("appUrlOpen", { url: "file:///var/mobile/Inbox/Subcontract%20A.pdf" }); });
    expect(screen.getByTestId("where").textContent).toBe("/");
    expect(consumeNativeDestination()).toBe("/upload");
    expect(takeShared()?.name).toBe("Subcontract A.pdf");
  });

  it("a file the app was cold-launched with is picked up, read before appUrlOpen is attached", async () => {
    await setToken("token-1");
    os.app.getLaunchUrl.mockResolvedValue({ url: "content://com.android.providers/7" });
    await mountBridge();
    await waitFor(() => expect(screen.getByTestId("where").textContent).toBe("/upload"));
    expect(takeShared()?.path).toBe("content://com.android.providers/7");
    const appUrlOpenCall = os.app.addListener.mock.calls.findIndex(([event]) => event === "appUrlOpen");
    expect(os.app.getLaunchUrl.mock.invocationCallOrder[0])
      .toBeLessThan(os.app.addListener.mock.invocationCallOrder[appUrlOpenCall]);
  });
});

describe("the upload page sends a shared file like a picked one", () => {
  beforeEach(() => {
    while (takeShared()) { /* drain anything left over */ }
    vi.mocked(uploadContract).mockReset().mockResolvedValue({ applicationId: "app-5", documentId: "d1", requirements: [] });
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true, blob: async () => new Blob(["%PDF-1.4"], { type: "application/pdf" }) })));
  });
  afterEach(() => { vi.unstubAllGlobals(); });

  function renderUploadPage() {
    render(
      <MemoryRouter initialEntries={["/upload"]}>
        <Routes>
          <Route path="/upload" element={<UploadContractPage />} />
          <Route path="*" element={<Where />} />
        </Routes>
      </MemoryRouter>,
    );
  }

  it("uploads a file that was shared before the page opened", async () => {
    holdSharedUrl("file:///x/Inbox/Subcontract%20A.pdf");
    renderUploadPage();
    await waitFor(() => expect(uploadContract).toHaveBeenCalledTimes(1));
    const sent = vi.mocked(uploadContract).mock.calls[0][0];
    expect(sent.name).toBe("Subcontract A.pdf");
    expect(sent.type).toBe("application/pdf");
    expect(fetch).toHaveBeenCalledWith("file:///x/Inbox/Subcontract%20A.pdf");
    expect(await screen.findByTestId("where")).toHaveProperty("textContent", "/requirements/app-5");
    expect(takeShared()).toBeNull();
  });

  it("uploads a file shared while the page is open", async () => {
    renderUploadPage();
    expect(uploadContract).not.toHaveBeenCalled();
    act(() => { holdSharedUrl("file:///x/Inbox/Subcontract%20B.docx"); });
    await waitFor(() => expect(uploadContract).toHaveBeenCalledTimes(1));
    const sent = vi.mocked(uploadContract).mock.calls[0][0];
    expect(sent.name).toBe("Subcontract B.docx");
    expect(sent.type).toBe("application/vnd.openxmlformats-officedocument.wordprocessingml.document");
  });
});
