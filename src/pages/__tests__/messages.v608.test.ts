import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

describe("BI_CLIENT_BLOCK_v608 messages wiring", () => {
  it("protects the messages screen and exposes it from home", () => {
    const router = readFileSync("src/router/AppRouter.tsx", "utf8");
    const home = readFileSync("src/pages/HomePage.tsx", "utf8");
    expect(router).toContain('path="/messages"');
    expect(router).toContain("<RequireApplicant><MessagesPage /></RequireApplicant>");
    expect(home).toContain('navigate("/messages")');
    expect(home).toContain("unreadCount");
  });

  it("loads a thread and posts replies with attachments", () => {
    const page = readFileSync("src/pages/MessagesPage.tsx", "utf8");
    expect(page).toContain('apiRequest<ThreadResponse>("/applicants/messages")');
    expect(page).toContain('form.append("files", file, file.name)');
    expect(page).toContain("Send reply");
  });
});
