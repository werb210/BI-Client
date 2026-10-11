// BI_CLIENT_NATIVE_WIRING_v237
import { readFileSync } from "node:fs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";

const apiGet = vi.hoisted(() => vi.fn());
const apiRequest = vi.hoisted(() => vi.fn(async () => ({})));
vi.mock("@/api/client", () => ({ api: { get: apiGet, post: vi.fn() }, apiRequest }));

import ActionCenter from "@/components/ActionCenter";
import HomePage from "@/pages/HomePage";
import RequirementsPage from "@/pages/RequirementsPage";

const read = (p: string) => readFileSync(p, "utf-8");

const center = (applicationId?: string) => ({
  ...(applicationId ? { applicationId } : {}),
  outstanding: [
    { key: "d", kind: "document", label: "Certificate of insurance", urgent: false },
    { key: "q", kind: "question", label: "Annual revenue", urgent: false },
  ],
  completed: [],
  outstandingCount: 2,
  canSubmit: false,
});

function Where() {
  const loc = useLocation();
  return <div data-testid="where">{loc.pathname}</div>;
}

beforeEach(() => { apiGet.mockReset(); apiRequest.mockClear(); });
afterEach(() => cleanup());

describe("iOS native wiring", () => {
  it("registers the VisionKit scanner through a bridge subclass", () => {
    const swift = read("ios/App/App/DocumentScannerPlugin.swift");
    expect(swift).toContain("class BorealBridgeViewController: CAPBridgeViewController");
    expect(swift).toContain("registerPluginInstance(DocumentScannerPlugin())");
  });
  it("points the storyboard at that subclass in the App module", () => {
    const sb = read("ios/App/App/Base.lproj/Main.storyboard");
    expect(sb).toContain('customClass="BorealBridgeViewController" customModule="App"');
    expect(sb).not.toContain('customClass="CAPBridgeViewController"');
  });
  it("declares the Face ID usage string", () => {
    expect(read("ios/App/App/Info.plist")).toContain("<key>NSFaceIDUsageDescription</key>");
  });
});

describe("Action Center actions", () => {
  it("renders a button only when a handler and a resolved application exist", async () => {
    const onAction = vi.fn();
    apiGet.mockResolvedValue(center("APP-9"));
    render(<ActionCenter applicationId="me" onAction={onAction} />);
    fireEvent.click(await screen.findByRole("button", { name: "Upload" }));
    expect(onAction).toHaveBeenLastCalledWith(expect.objectContaining({ key: "d", kind: "document" }), "APP-9");
    fireEvent.click(screen.getByRole("button", { name: "Answer" }));
    expect(onAction).toHaveBeenLastCalledWith(expect.objectContaining({ key: "q", kind: "question" }), "APP-9");
  });

  it("shows no button without a handler", async () => {
    apiGet.mockResolvedValue(center("APP-9"));
    render(<ActionCenter applicationId="me" />);
    expect(await screen.findByText("Certificate of insurance")).toBeTruthy();
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("shows no button when the server did not resolve the application", async () => {
    apiGet.mockResolvedValue(center());
    render(<ActionCenter applicationId="me" onAction={vi.fn()} />);
    expect(await screen.findByText("Certificate of insurance")).toBeTruthy();
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("is on the home screen, resolved server-side with me", async () => {
    apiGet.mockImplementation(async (path: string) => {
      if (path === "/applicants/action-center/me") return center("APP-9");
      if (path === "/applicants/me/progress") return { progress: null };
      throw new Error("unexpected " + path);
    });
    const renderHome = () => render(
      <MemoryRouter initialEntries={["/home"]}>
        <Routes>
          <Route path="/home" element={<HomePage />} />
          <Route path="*" element={<Where />} />
        </Routes>
      </MemoryRouter>,
    );
    renderHome();
    fireEvent.click(await screen.findByRole("button", { name: "Upload" }));
    expect(screen.getByTestId("where").textContent).toBe("/requirements/APP-9");
    expect(apiGet).toHaveBeenCalledWith("/applicants/action-center/me");
    cleanup();

    renderHome();
    fireEvent.click(await screen.findByRole("button", { name: "Answer" }));
    expect(screen.getByTestId("where").textContent).toBe("/questions/APP-9");
  });

  it("still leaves the requirements page mount untouched (no action buttons there)", async () => {
    apiGet.mockImplementation(async (path: string) => {
      if (path === "/applicants/action-center/APP-7") return center("APP-7");
      if (path === "/applicants/applications/APP-7/requirements") return { requirements: [] };
      if (path === "/applicants/applications/APP-7/products") return { country: "CA" };
      throw new Error("unexpected " + path);
    });
    render(
      <MemoryRouter initialEntries={["/requirements/APP-7"]}>
        <Routes><Route path="/requirements/:applicationId" element={<RequirementsPage />} /></Routes>
      </MemoryRouter>,
    );
    const panel = await screen.findByTestId("bi-action-center");
    await waitFor(() => expect(apiGet).toHaveBeenCalledWith("/applicants/action-center/APP-7"));
    expect(panel.querySelector("button")).toBeNull();
  });
});
