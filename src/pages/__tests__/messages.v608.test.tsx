// BI_CLIENT_BLOCK_v608 - the messages screen: guarded route, reachable from
// home with an unread badge, loads the thread and posts replies with files.
import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { liveJwt } from "@/test-utils/pages2-helpers";

const apiRequest = vi.hoisted(() => vi.fn());

vi.mock("@/api/client", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  apiRequest,
}));
// Home's other panels make their own requests; they are not under test here.
vi.mock("@/components/ActionCenter", () => ({ default: () => null }));
vi.mock("@/components/ApplicationProgress", () => ({ default: () => null }));
vi.mock("@/components/onboarding/FeatureTour", () => ({ default: () => null }));

import AppRouter from "@/router/AppRouter";
import { expireSession, setToken } from "@/auth/token";

type Handler = (path: string, init?: RequestInit) => unknown;
let handler: Handler;

const THREAD = {
  messages: [
    { id: "m1", body: "Please send your subcontract.", createdAt: "2026-10-01T15:00:00Z", sender: "staff" },
    { id: "m2", body: "Will do.", createdAt: "2026-10-01T16:00:00Z", fromApplicant: true, attachments: [{ id: "a1", name: "old.pdf", url: "https://files.example/old.pdf" }] },
  ],
};

beforeEach(async () => {
  await expireSession();
  localStorage.clear();
  apiRequest.mockReset();
  handler = (path) => {
    if (path === "/applicants/messages/unread-count") return { unreadCount: 3 };
    if (path === "/applicants/messages") return THREAD;
    if (path === "/applicants/messages/read") return {};
    throw new Error(`unexpected request ${path}`);
  };
  apiRequest.mockImplementation(async (path: string, init?: RequestInit) => handler(path, init));
});

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <AppRouter />
    </MemoryRouter>,
  );
}

describe("BI_CLIENT_BLOCK_v608 messages wiring", () => {
  it("protects the messages screen", async () => {
    renderAt("/messages");
    expect(screen.getByLabelText("Mobile number")).toBeTruthy();
    expect(screen.queryByRole("heading", { name: "Messages" })).toBeNull();
    expect(apiRequest).not.toHaveBeenCalledWith("/applicants/messages");
  });

  it("exposes it from home with the unread count", async () => {
    await setToken(liveJwt());
    renderAt("/home");
    expect(await screen.findByLabelText("3 unread messages")).toBeTruthy();
    expect(apiRequest).toHaveBeenCalledWith("/applicants/messages/unread-count");

    fireEvent.click(screen.getByRole("button", { name: /^Messages/ }));
    expect(await screen.findByRole("heading", { name: "Messages" })).toBeTruthy();
    // Still behind the applicant guard, which adds the account bar.
    expect(screen.getByTestId("account-bar")).toBeTruthy();
    expect(await screen.findByText("Please send your subcontract.")).toBeTruthy();
  });

  it("caps a large unread count and shows no badge when nothing is unread", async () => {
    const base = handler;
    let unread = 150;
    handler = (path, init) => (path === "/applicants/messages/unread-count" ? { unreadCount: unread } : base(path, init));
    await setToken(liveJwt());
    const first = renderAt("/home");
    expect((await screen.findByLabelText("150 unread messages")).textContent).toBe("99+");
    first.unmount();

    unread = 0;
    apiRequest.mockClear();
    renderAt("/home");
    await waitFor(() => expect(apiRequest).toHaveBeenCalledWith("/applicants/messages/unread-count"));
    await act(async () => { await Promise.resolve(); });
    expect(screen.getByRole("button", { name: /^Messages/ })).toBeTruthy();
    expect(screen.queryByLabelText(/unread messages/)).toBeNull();
  });

  it("loads a thread and marks it read", async () => {
    await setToken(liveJwt());
    renderAt("/messages");
    const thread = await screen.findByRole("region", { name: "Message thread" });
    await within(thread).findByText("Please send your subcontract.");
    expect(apiRequest).toHaveBeenCalledWith("/applicants/messages");
    const [staff, mine] = within(thread).getAllByRole("article");
    expect(within(staff).getByText("Boreal")).toBeTruthy();
    expect(within(mine).getByText("You")).toBeTruthy();
    expect(within(mine).getByRole("link", { name: "old.pdf" }).getAttribute("href")).toBe("https://files.example/old.pdf");
    await waitFor(() => expect(apiRequest).toHaveBeenCalledWith("/applicants/messages/read", { method: "POST" }));
  });

  it("posts replies with attachments", async () => {
    await setToken(liveJwt());
    renderAt("/messages");
    await screen.findByText("Please send your subcontract.");

    const send = screen.getByRole("button", { name: "Send reply" });
    expect(send).toHaveProperty("disabled", true);

    const reply = { id: "m3", body: "Here it is.", createdAt: "2026-10-02T10:00:00Z", sender: "applicant", attachments: [{ id: "a2", name: "contract.pdf" }] };
    const base = handler;
    handler = (path, init) => (path === "/applicants/messages" && init?.method === "POST" ? reply : base(path, init));

    fireEvent.change(screen.getByLabelText("Reply"), { target: { value: "  Here it is.  " } });
    const files = [
      new File(["%PDF"], "contract.pdf", { type: "application/pdf" }),
      new File(["jpeg"], "photo.jpg", { type: "image/jpeg" }),
    ];
    const input = document.getElementById("message-files") as HTMLInputElement;
    fireEvent.change(input, { target: { files } });
    expect(screen.getByText("contract.pdf, photo.jpg")).toBeTruthy();

    expect(send).toHaveProperty("disabled", false);
    fireEvent.click(send);

    await screen.findByText("Here it is.");
    const call = apiRequest.mock.calls.find(([path, init]) => path === "/applicants/messages" && init?.method === "POST");
    expect(call).toBeTruthy();
    const form = (call![1] as RequestInit).body as FormData;
    expect(form).toBeInstanceOf(FormData);
    expect(form.get("message")).toBe("Here it is.");
    const sent = form.getAll("files") as File[];
    expect(sent.map((f) => f.name)).toEqual(["contract.pdf", "photo.jpg"]);
    // The draft is cleared after sending.
    expect((screen.getByLabelText("Reply") as HTMLTextAreaElement).value).toBe("");
    expect(screen.queryByText("contract.pdf, photo.jpg")).toBeNull();
  });

  it("keeps the draft and says so when a reply fails", async () => {
    await setToken(liveJwt());
    renderAt("/messages");
    await screen.findByText("Please send your subcontract.");
    const base = handler;
    handler = (path, init) => {
      if (path === "/applicants/messages" && init?.method === "POST") throw new Error("network");
      return base(path, init);
    };
    fireEvent.change(screen.getByLabelText("Reply"), { target: { value: "Hello" } });
    fireEvent.click(screen.getByRole("button", { name: "Send reply" }));
    expect((await screen.findByRole("alert")).textContent).toBe("Your reply was not sent. Please try again.");
    expect((screen.getByLabelText("Reply") as HTMLTextAreaElement).value).toBe("Hello");
  });
});
