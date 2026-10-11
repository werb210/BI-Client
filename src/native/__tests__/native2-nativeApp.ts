// Test helper (group native2): a stand-in for @capacitor/app that records the
// listeners NativeBridge attaches so a test can fire them like the OS does.
import { vi } from "vitest";

type Handler = (event: any) => unknown;

export function createNativeApp() {
  const handlers = new Map<string, Handler>();
  const removed: string[] = [];
  const app = {
    getLaunchUrl: vi.fn(async (): Promise<{ url: string } | undefined> => undefined),
    addListener: vi.fn(async (event: string, handler: Handler) => {
      handlers.set(event, handler);
      return { remove: async () => { removed.push(event); } };
    }),
    exitApp: vi.fn(async () => undefined),
  };
  return {
    app,
    removed,
    /** Fires a listener NativeBridge registered, as the OS would. */
    fire(event: string, payload: unknown = {}) {
      const handler = handlers.get(event);
      if (!handler) throw new Error(`no ${event} listener`);
      return handler(payload);
    },
    has: (event: string) => handlers.has(event),
  };
}
