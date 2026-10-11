import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { Capacitor } from "@capacitor/core";
import { App as NativeApp } from "@capacitor/app";
import { Preferences } from "@capacitor/preferences";
import { SecureStorage } from "@aparajita/capacitor-secure-storage";
import { Camera, CameraResultType, CameraSource } from "@capacitor/camera";
import { FilePicker } from "@capawesome/capacitor-file-picker";
import { Network } from "@capacitor/network";
import {
  APPLICANT_PHONE_KEY,
  APPLICANT_TOKEN_KEY,
  clearToken,
  currentApplicantId,
  expireSession,
  getCachedToken,
  getPhone,
  restoreToken,
  setPhone,
  setToken,
} from "@/auth/token";
import { uploadContract } from "@/api/contract";
import { normalizeNativeSource } from "@/upload/normalize";
import { unseal } from "@/secure/vault";
import UploadContractPage from "@/pages/UploadContractPage";
import NativeBridge from "@/native/NativeBridge";

vi.mock("@/api/contract", () => ({ uploadContract: vi.fn() }));

const onDevice = () => vi.spyOn(Capacitor, "isNativePlatform").mockReturnValue(true);
const jwt = (claims: object) => `h.${btoa(JSON.stringify(claims))}.s`;

beforeEach(() => {
  localStorage.clear();
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("native plugin runtime surface", () => {
  describe("keeps native authentication on secure storage without a plaintext fallback", () => {
    it("stores the token in secure storage, not localStorage", async () => {
      onDevice();
      const set = vi.spyOn(SecureStorage, "set");
      await setToken("tok-1");
      expect(set).toHaveBeenCalledWith(APPLICANT_TOKEN_KEY, "tok-1");
      expect(localStorage.getItem(APPLICANT_TOKEN_KEY)).toBeNull();
      expect(getCachedToken()).toBe("tok-1");
    });

    it("restores the token from secure storage", async () => {
      onDevice();
      vi.spyOn(SecureStorage, "get").mockResolvedValue("tok-2");
      expect(await restoreToken()).toBe("tok-2");
    });

    it("is fail-closed: a secure storage failure never falls back to plaintext", async () => {
      onDevice();
      localStorage.setItem(APPLICANT_TOKEN_KEY, "plaintext-token");
      vi.spyOn(SecureStorage, "get").mockRejectedValue(new Error("keychain locked"));
      expect(await restoreToken()).toBeNull();
      expect(getCachedToken()).toBeNull();
    });

    it("removes only the applicant token from secure storage when the session ends", async () => {
      onDevice();
      const remove = vi.spyOn(SecureStorage, "remove");
      await setToken("tok-3");
      await expireSession();
      expect(remove).toHaveBeenCalledWith(APPLICANT_TOKEN_KEY);
      expect(getCachedToken()).toBeNull();

      remove.mockClear();
      await setToken("tok-4");
      await clearToken();
      expect(remove).toHaveBeenCalledWith(APPLICANT_TOKEN_KEY);
      expect(getCachedToken()).toBeNull();
    });
  });

  describe("keeps native document and photo selection on native plugins", () => {
    function Where() {
      return <p data-testid="where">{useLocation().pathname}</p>;
    }
    function renderPage() {
      render(
        <MemoryRouter initialEntries={["/upload"]}>
          <Routes>
            <Route path="/upload" element={<UploadContractPage />} />
            <Route path="*" element={<Where />} />
          </Routes>
        </MemoryRouter>,
      );
    }

    beforeEach(() => {
      vi.mocked(uploadContract).mockReset().mockResolvedValue({ applicationId: "app-1", documentId: "d1", requirements: [] });
      vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true, blob: async () => new Blob(["data"], { type: "application/pdf" }) })));
    });

    it("on a phone, choosing a file opens the native file picker and uploads the pick", async () => {
      onDevice();
      const inputClick = vi.spyOn(HTMLInputElement.prototype, "click");
      const pick = vi.spyOn(FilePicker, "pickFiles").mockResolvedValue({
        files: [{ name: "Sub.pdf", mimeType: "application/pdf", size: 4, path: "file:///cache/Sub.pdf" }],
      } as never);
      renderPage();
      fireEvent.click(screen.getByRole("button", { name: "Choose file" }));
      await waitFor(() => expect(uploadContract).toHaveBeenCalledTimes(1));
      expect(pick).toHaveBeenCalledWith(expect.objectContaining({ limit: 1 }));
      expect(inputClick).not.toHaveBeenCalled();
      expect(vi.mocked(uploadContract).mock.calls[0][0].name).toBe("Sub.pdf");
      expect(await screen.findByTestId("where")).toHaveProperty("textContent", "/requirements/app-1");
    });

    it("on the web, choosing a file opens the browser file input instead", () => {
      const inputClick = vi.spyOn(HTMLInputElement.prototype, "click").mockImplementation(() => undefined);
      const pick = vi.spyOn(FilePicker, "pickFiles");
      renderPage();
      fireEvent.click(screen.getByRole("button", { name: "Choose file" }));
      expect(inputClick).toHaveBeenCalledTimes(1);
      expect(pick).not.toHaveBeenCalled();
      expect(screen.queryByRole("button", { name: "Take Photo" })).toBeNull();
    });

    it("takes and chooses photos through the native camera", async () => {
      onDevice();
      const getPhoto = vi.spyOn(Camera, "getPhoto").mockResolvedValue({ webPath: "capacitor://localhost/_capacitor_file_/photo.jpeg", format: "jpeg" } as never);
      renderPage();
      fireEvent.click(screen.getByRole("button", { name: "Take Photo" }));
      await waitFor(() => expect(uploadContract).toHaveBeenCalledTimes(1));
      expect(getPhoto).toHaveBeenCalledWith(expect.objectContaining({ source: CameraSource.Camera, resultType: CameraResultType.Uri }));
      const photo = vi.mocked(uploadContract).mock.calls[0][0];
      expect(photo.name).toBe("contract.jpg");
      expect(photo.type).toBe("image/jpeg");
    });

    it("chooses an existing photo from the library", async () => {
      onDevice();
      const getPhoto = vi.spyOn(Camera, "getPhoto").mockRejectedValue(new Error("User cancelled photos app"));
      renderPage();
      fireEvent.click(screen.getByRole("button", { name: "Choose Photo" }));
      await waitFor(() => expect(getPhoto).toHaveBeenCalledWith(expect.objectContaining({ source: CameraSource.Photos })));
      // A cancelled pick is not an error.
      await act(async () => { await Promise.resolve(); });
      expect(screen.queryByText(/did not go through/)).toBeNull();
      expect(uploadContract).not.toHaveBeenCalled();
    });

    it("asks the native network plugin before uploading, and keeps an offline capture for this applicant", async () => {
      onDevice();
      await setToken(jwt({ sub: "appl-7" }));
      const status = vi.spyOn(Network, "getStatus").mockResolvedValue({ connected: false } as never);
      const stored = vi.spyOn(Preferences, "set");
      vi.spyOn(FilePicker, "pickFiles").mockResolvedValue({
        files: [{ name: "Sub.pdf", mimeType: "application/pdf", size: 4, path: "file:///cache/Sub.pdf" }],
      } as never);
      renderPage();
      fireEvent.click(screen.getByRole("button", { name: "Choose file" }));
      expect(await screen.findByText(/You're offline\. We've saved this document/)).toBeTruthy();
      expect(status).toHaveBeenCalled();
      expect(uploadContract).not.toHaveBeenCalled();
      const write = stored.mock.calls.find(([o]) => (o as { key: string }).key === "boreal_bi_upload_queue");
      expect(write).toBeTruthy();
      const queued = JSON.parse((await unseal((write![0] as { value: string }).value))!);
      expect(queued).toEqual([expect.objectContaining({ filename: "Sub.pdf", applicantId: currentApplicantId(), documentType: "subcontract" })]);
      expect(currentApplicantId()).toBe("appl-7");
      await expireSession();
    });
  });

  describe("keeps the active App, Preferences, and native file normalization surfaces", () => {
    it("NativeBridge listens to the native App plugin and announces resume", async () => {
      onDevice();
      const handlers = new Map<string, (e: any) => void>();
      const removed: string[] = [];
      const addListener = vi.spyOn(NativeApp, "addListener").mockImplementation((async (event: string, handler: (e: any) => void) => {
        handlers.set(event, handler);
        return { remove: async () => { removed.push(event); } };
      }) as never);
      const { unmount } = render(<MemoryRouter><NativeBridge /></MemoryRouter>);
      await waitFor(() => expect(handlers.has("resume")).toBe(true));
      expect([...handlers.keys()]).toEqual(expect.arrayContaining(["appUrlOpen", "backButton", "appStateChange", "pause", "resume"]));
      expect(addListener).toHaveBeenCalled();

      const resumed = vi.fn();
      window.addEventListener("boreal:native-resume", resumed);
      handlers.get("resume")!({});
      window.removeEventListener("boreal:native-resume", resumed);
      expect(resumed).toHaveBeenCalledTimes(1);

      unmount();
      expect(removed).toEqual(expect.arrayContaining(["appUrlOpen", "resume"]));
    });

    it("keeps the phone number in native Preferences on a phone", async () => {
      onDevice();
      const set = vi.spyOn(Preferences, "set");
      const get = vi.spyOn(Preferences, "get").mockResolvedValue({ value: "+15551234567" });
      await setPhone("+15551234567");
      expect(set).toHaveBeenCalledWith({ key: APPLICANT_PHONE_KEY, value: "+15551234567" });
      expect(localStorage.getItem(APPLICANT_PHONE_KEY)).toBeNull();
      expect(await getPhone()).toBe("+15551234567");
      expect(get).toHaveBeenCalledWith({ key: APPLICANT_PHONE_KEY });
    });

    it("turns a native file path into an uploadable File", async () => {
      const convert = vi.spyOn(Capacitor, "convertFileSrc").mockImplementation((p: string) => p.replace("file://", "capacitor://localhost/_capacitor_file_"));
      const fetchMock = vi.fn(async () => ({ ok: true, blob: async () => new Blob(["%PDF"], { type: "" }) }));
      vi.stubGlobal("fetch", fetchMock);
      const file = await normalizeNativeSource({ name: "Contract.PDF", path: "file:///cache/Contract.PDF" });
      expect(convert).toHaveBeenCalledWith("file:///cache/Contract.PDF");
      expect(fetchMock).toHaveBeenCalledWith("capacitor://localhost/_capacitor_file_/cache/Contract.PDF");
      expect(file).toBeInstanceOf(File);
      expect(file.name).toBe("Contract.PDF");
      expect(file.type).toBe("application/pdf");
      await expect(normalizeNativeSource({ name: "big.pdf", size: 26 * 1024 * 1024, path: "file:///cache/big.pdf" })).rejects.toThrow("file_too_large");
      await expect(normalizeNativeSource({ name: "notes.txt", path: "file:///cache/notes.txt" })).rejects.toThrow("unsupported_file_type");
    });
  });
});
