// BI_CLIENT_WIDGET_BRAND_v631
import { readFileSync } from "node:fs";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, waitFor } from "@testing-library/react";

const apiGet = vi.hoisted(() => vi.fn());
vi.mock("@/api/client", () => ({ api: { get: apiGet, post: vi.fn() }, apiRequest: vi.fn() }));
vi.mock("@/native/clientWidget", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/native/clientWidget")>()),
  updateClientWidget: vi.fn(async () => undefined),
}));

import ActionCenter from "@/components/ActionCenter";
import { actionLine, clearClientWidget, mergeWidget, updateClientWidget } from "@/native/clientWidget";

afterEach(() => cleanup());

describe("v631 Boreal Risk widget", () => {
  it("says what to do in plain words", () => {
    expect(actionLine([])).toBe("Nothing to do");
    expect(actionLine([{ kind: "document" }])).toBe("Upload 1 document");
    expect(actionLine([{ kind: "question" }, { kind: "question" }])).toBe("Answer 2 questions");
    expect(actionLine([{ kind: "document" }, { kind: "question" }])).toBe("Upload 1 document \u00b7 Answer 1 question");
  });

  it("keeps the action line alongside stage and count", async () => {
    await clearClientWidget();
    expect(mergeWidget("In review", 1, "Upload 1 document")).toEqual({ stage: "In review", toDoCount: 1, action: "Upload 1 document" });
    expect(mergeWidget(undefined, 0, "Nothing to do")).toEqual({ stage: "In review", toDoCount: 0, action: "Nothing to do" });
  });

  it("the action centre sends the widget the action line for its outstanding items", async () => {
    apiGet.mockResolvedValue({
      applicationId: "APP-7",
      outstanding: [
        { key: "a", kind: "document", label: "Certificate", urgent: false },
        { key: "b", kind: "question", label: "Revenue", urgent: false },
      ],
      completed: [],
      outstandingCount: 2,
      canSubmit: false,
    });
    render(<ActionCenter applicationId="APP-7" />);
    await waitFor(() => expect(updateClientWidget).toHaveBeenCalledWith(undefined, 2, "Upload 1 document \u00b7 Answer 1 question", "APP-7"));
  });

  it("the native widget is branded and shows stage + action", () => {
    const swift = readFileSync("ios/App/ClientWidgetExtension/ClientWidget.swift", "utf-8");
    expect(swift).toContain("BI_CLIENT_WIDGET_BRAND_v631");
    expect(swift).toContain("Boreal Risk");
    expect(swift).toContain("containerBackground(borealNavy, for: .widget)");
    expect(swift).toContain("entry.action");
    expect(readFileSync("ios/App/App/AppDelegate.swift", "utf-8")).toContain('defaults?.set(action, forKey: "action")');
  });
});
