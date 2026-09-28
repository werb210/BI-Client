// BI_CLIENT_WIDGET_BRAND_v631
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { actionLine, clearClientWidget, mergeWidget } from "../clientWidget";

describe("v631 Boreal Risk widget", () => {
  it("says what to do in plain words", () => {
    expect(actionLine([])).toBe("Nothing to do");
    expect(actionLine([{ kind: "document" }])).toBe("Upload 1 document");
    expect(actionLine([{ kind: "question" }, { kind: "question" }])).toBe("Answer 2 questions");
    expect(actionLine([{ kind: "document" }, { kind: "question" }])).toBe("Upload 1 document · Answer 1 question");
  });
  it("keeps the action line alongside stage and count", async () => {
    await clearClientWidget();
    expect(mergeWidget("In review", 1, "Upload 1 document")).toEqual({ stage: "In review", toDoCount: 1, action: "Upload 1 document" });
    expect(mergeWidget(undefined, 0, "Nothing to do")).toEqual({ stage: "In review", toDoCount: 0, action: "Nothing to do" });
  });
  it("the native widget is branded and shows stage + action", () => {
    const swift = readFileSync("ios/App/ClientWidgetExtension/ClientWidget.swift", "utf-8");
    expect(swift).toContain("BI_CLIENT_WIDGET_BRAND_v631");
    expect(swift).toContain("Boreal Risk");
    expect(swift).toContain("containerBackground(borealNavy, for: .widget)");
    expect(swift).toContain("entry.action");
    expect(readFileSync("ios/App/App/AppDelegate.swift", "utf-8")).toContain('defaults?.set(action, forKey: "action")');
    expect(readFileSync("src/components/ActionCenter.tsx", "utf-8")).toContain("m.actionLine(d?.outstanding)");
  });
});
