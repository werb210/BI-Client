// BI_CLIENT_OFFLINE_v302
// Offline mode for BI-Client. Two pieces:
//  - read cache: the last good answer to each screen's GET, shown when the
//    connection drops instead of "We could not load ...";
//  - outbox: answer, coverage and requirement saves made offline are kept on
//    the phone and sent in order when the connection returns. A newer save to
//    the same place replaces an older one (each save carries the full set).
// Submitting, signing in and starting an application still need a connection.
import { Capacitor } from "@capacitor/core";
import { Preferences } from "@capacitor/preferences";

const CACHE_PREFIX = "boreal_bi_offline_cache:";
const CACHE_INDEX = "boreal_bi_offline_cache_index";
const OUTBOX = "boreal_bi_outbox";
const MAX_CACHE_AGE_MS = 7 * 24 * 3600 * 1000;
export const OUTBOX_CHANGED = "boreal:outbox-changed";
export const OFFLINE_COPY = "boreal:offline-copy";

export class OfflineQueuedError extends Error {
  constructor() { super("saved_offline"); this.name = "OfflineQueuedError"; }
}

export type OutboxItem = { id: string; path: string; body: string; queuedAt: number; attempts: number; handedAt?: number };

const QUEUEABLE = [
  /^\/applicants\/applications\/[^/]+\/answers$/,
  /^\/applicants\/applications\/[^/]+\/products$/,
  /^\/applicants\/applications\/[^/]+\/requirements\/[^/]+\/confirm$/,
];

export function isQueueable(method: string, path: string): boolean {
  return method.toUpperCase() === "POST" && QUEUEABLE.some((re) => re.test(path));
}

/** fetch rejects with TypeError when there is no connection. */
export function isNetworkError(err: unknown): boolean {
  return err instanceof TypeError || (err as { name?: string })?.name === "TypeError" || /network|failed to fetch|load failed/i.test(String((err as Error)?.message ?? ""));
}

const kv = {
  async get(key: string): Promise<string | null> {
    try {
      if (Capacitor.isNativePlatform()) return (await Preferences.get({ key })).value ?? null;
      return localStorage.getItem(key);
    } catch { return null; }
  },
  async set(key: string, value: string): Promise<void> {
    try {
      if (Capacitor.isNativePlatform()) await Preferences.set({ key, value });
      else localStorage.setItem(key, value);
    } catch { /* storage full or blocked */ }
  },
  async remove(key: string): Promise<void> {
    try {
      if (Capacitor.isNativePlatform()) await Preferences.remove({ key });
      else localStorage.removeItem(key);
    } catch { /* ignore */ }
  },
};

export async function cacheResponse(path: string, data: unknown): Promise<void> {
  await kv.set(CACHE_PREFIX + path, JSON.stringify({ savedAt: Date.now(), data }));
  const index = new Set<string>(JSON.parse((await kv.get(CACHE_INDEX)) ?? "[]"));
  index.add(path);
  await kv.set(CACHE_INDEX, JSON.stringify([...index]));
}

export async function cachedResponse<T>(path: string): Promise<T | undefined> {
  try {
    const raw = await kv.get(CACHE_PREFIX + path);
    if (!raw) return undefined;
    const v = JSON.parse(raw) as { savedAt: number; data: T };
    return Date.now() - v.savedAt > MAX_CACHE_AGE_MS ? undefined : v.data;
  } catch { return undefined; }
}

export async function readOutbox(): Promise<OutboxItem[]> {
  try {
    const v = JSON.parse((await kv.get(OUTBOX)) ?? "[]");
    return Array.isArray(v) ? v : [];
  } catch { return []; }
}

async function writeOutbox(items: OutboxItem[]): Promise<void> {
  await kv.set(OUTBOX, JSON.stringify(items));
  try { window.dispatchEvent(new CustomEvent(OUTBOX_CHANGED, { detail: items.length })); } catch { /* not in a browser */ }
}

export async function enqueueSave(path: string, body: string): Promise<void> {
  const items = (await readOutbox()).filter((i) => i.path !== path);
  items.push({ id: `${Date.now()}-${Math.random().toString(36).slice(2)}`, path, body, queuedAt: Date.now(), attempts: 0 });
  await writeOutbox(items);
}

/**
 * Sends queued saves oldest first. Stops at the first network failure (still
 * offline). A save the server rejects (4xx) is dropped so it cannot block the rest.
 */
export async function drainOutbox(send: (item: OutboxItem) => Promise<void>): Promise<{ sent: number; left: number }> {
  let items = await readOutbox();
  let sent = 0;
  let index = 0;
  while (index < items.length) {
    const item = items[index];
    // BI_CLIENT_BACKGROUND_SYNC_v308 - the phone is already sending this save.
    if (item.handedAt) { index += 1; continue; }
    try {
      await send(item);
      sent += 1;
      items = items.filter((i) => i.id !== item.id);
      await writeOutbox(items);
    } catch (err) {
      const status = (err as { status?: number })?.status ?? 0;
      if (status >= 400 && status < 500) {
        items = items.filter((i) => i.id !== item.id);
        await writeOutbox(items);
        continue;
      }
      break;
    }
  }
  return { sent, left: items.length };
}

// BI_CLIENT_BACKGROUND_SYNC_v308
export async function setOutboxHanded(id: string, handedAt: number | undefined): Promise<void> {
  await writeOutbox((await readOutbox()).map((i) => (i.id === id ? { ...i, handedAt } : i)));
}

export async function removeOutboxItem(id: string): Promise<void> {
  await writeOutbox((await readOutbox()).filter((i) => i.id !== id));
}

/** Sign-out: nothing from this applicant stays on the phone. */
export async function clearOfflineData(): Promise<void> {
  const index: string[] = JSON.parse((await kv.get(CACHE_INDEX)) ?? "[]");
  await Promise.all(index.map((p) => kv.remove(CACHE_PREFIX + p)));
  await kv.remove(CACHE_INDEX);
  await writeOutbox([]);
}
