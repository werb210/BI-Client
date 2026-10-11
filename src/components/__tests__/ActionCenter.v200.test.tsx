// BI_CLIENT_ACTION_CENTER_v200
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";

const apiGet = vi.hoisted(() => vi.fn());
vi.mock("@/api/client", () => ({ api: { get: apiGet, post: vi.fn() }, apiRequest: vi.fn() }));

import ActionCenter from "@/components/ActionCenter";
import RequirementsPage from "@/pages/RequirementsPage";

const item = (key: string, kind: "document" | "question", label: string, urgent = false, extra: Record<string, unknown> = {}) => ({ key, kind, label, urgent, ...extra });

beforeEach(() => { apiGet.mockReset(); });
afterEach(() => cleanup());

describe("bi action center", () => {
  it("does not re-derive completion on the client", async () => {
    // Fields that look like completion signals are ignored: the server's lists are shown as sent.
    apiGet.mockResolvedValue({
      applicationId: "APP 1",
      outstanding: [
        item("a", "document", "Certificate of insurance", false, { review_status: "approved", purged_at: null, required: true }),
        item("b", "question", "Annual revenue", false, { required: false }),
      ],
      completed: [item("c", "document", "Signed contract", false, { review_status: "rejected", required: true })],
      outstandingCount: 2,
      canSubmit: false,
    });
    render(<ActionCenter applicationId="APP 1" />);
    expect(await screen.findByText("Certificate of insurance")).toBeTruthy();
    expect(apiGet).toHaveBeenCalledWith("/applicants/action-center/APP%201");
    expect(screen.getByText("Annual revenue")).toBeTruthy();
    expect(screen.getByText(/2 items remaining/)).toBeTruthy();
    expect(screen.getByText("Completed")).toBeTruthy();
    expect(screen.getByText("Signed contract")).toBeTruthy();
  });

  it("renders nothing rather than blanking the page on failure", async () => {
    apiGet.mockRejectedValue(new Error("500"));
    render(<div><p>Page content</p><ActionCenter applicationId="APP-1" /></div>);
    await waitFor(() => expect(apiGet).toHaveBeenCalled());
    await act(async () => { await new Promise((r) => setTimeout(r, 0)); });
    expect(screen.queryByTestId("bi-action-center")).toBeNull();
    expect(screen.getByText("Page content")).toBeTruthy();
  });

  it("tells the applicant when a document was rejected", async () => {
    apiGet.mockResolvedValue({
      outstanding: [item("a", "document", "Certificate of insurance", true), item("b", "document", "Licence", false)],
      completed: [], outstandingCount: 2, canSubmit: false,
    });
    render(<ActionCenter applicationId="APP-1" />);
    const notes = await screen.findAllByText(/the last one was not accepted/);
    expect(notes).toHaveLength(1); // only for the urgent (rejected) item
  });

  it("refreshes on focus and cleans the listener up", async () => {
    apiGet.mockResolvedValueOnce({ outstanding: [item("a", "document", "First label")], completed: [], outstandingCount: 1, canSubmit: false });
    const view = render(<ActionCenter applicationId="APP-1" />);
    expect(await screen.findByText("First label")).toBeTruthy();
    expect(apiGet).toHaveBeenCalledTimes(1);

    apiGet.mockResolvedValueOnce({ outstanding: [item("a", "document", "Second label")], completed: [], outstandingCount: 1, canSubmit: false });
    act(() => { window.dispatchEvent(new Event("focus")); });
    expect(await screen.findByText("Second label")).toBeTruthy();
    expect(apiGet).toHaveBeenCalledTimes(2);

    view.unmount();
    window.dispatchEvent(new Event("focus"));
    expect(apiGet).toHaveBeenCalledTimes(2);
  });

  it("stays quiet when there is nothing at all to show", async () => {
    apiGet.mockResolvedValue({ outstanding: [], completed: [], outstandingCount: 0, canSubmit: true });
    const { container } = render(<ActionCenter applicationId="APP-1" />);
    await waitFor(() => expect(apiGet).toHaveBeenCalled());
    await act(async () => { await new Promise((r) => setTimeout(r, 0)); });
    expect(container.innerHTML).toBe("");
  });
});

describe("mounting", () => {
  it("is on the requirements page, which has the application id", async () => {
    apiGet.mockImplementation(async (path: string) => {
      if (path === "/applicants/action-center/APP-7") return { outstanding: [item("a", "document", "Certificate of insurance")], completed: [], outstandingCount: 1, canSubmit: false };
      if (path === "/applicants/applications/APP-7/requirements") return { requirements: [] };
      if (path === "/applicants/applications/APP-7/products") return { country: "CA" };
      throw new Error("unexpected " + path);
    });
    render(
      <MemoryRouter initialEntries={["/requirements/APP-7"]}>
        <Routes><Route path="/requirements/:applicationId" element={<RequirementsPage />} /></Routes>
      </MemoryRouter>,
    );
    expect(await screen.findByTestId("bi-action-center")).toBeTruthy();
    expect(screen.getByText("Certificate of insurance")).toBeTruthy();
    expect(apiGet).toHaveBeenCalledWith("/applicants/action-center/APP-7");
  });
});
