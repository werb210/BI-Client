// BI_CLIENT_BACKGROUND_SYNC_v308
// Leaving the app hands the contract upload queue and saved-offline answers to
// the phone (iOS background URLSession / Android WorkManager), which sends them
// after the app is closed. Opening the app reads the results back: sent or
// refused items leave their queue; anything unfinished returns to in-app retry.
import { Capacitor, registerPlugin } from "@capacitor/core";
import { ENV } from "@/env";
import { readQueue, dequeue, setUploadHanded, type QueuedUpload } from "@/upload/queue";
import { readOutbox, removeOutboxItem, setOutboxHanded } from "@/offline/offlineStore";
import { refreshSessionForBackground } from "@/native/deviceSignIn";

type Result = { id: string; status: number };
interface BackgroundSyncPlugin {
  enqueue(options: { id: string; url: string; method: string; contentType: string; bodyBase64: string; headers: Record<string, string> }): Promise<void>;
  results(): Promise<{ results: Result[] }>;
  acknowledge(options: { ids: string[] }): Promise<void>;
  cancelAll(): Promise<void>;
}
const BackgroundSync = registerPlugin<BackgroundSyncPlugin>("BackgroundSync");

export const available = () => Capacitor.isNativePlatform() && Capacitor.isPluginAvailable("BackgroundSync");
const apiRoot = () => `${ENV.API_BASE}${ENV.API_PREFIX}`;

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  return btoa(binary);
}

function base64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i += 1) out[i] = bin.charCodeAt(i);
  return out;
}

export function multipartBody(file: { name: string; type: string; base64: string }, boundary = `Boundary-${Date.now().toString(36)}${Math.random().toString(36).slice(2)}`) {
  const enc = new TextEncoder();
  const head = enc.encode(`--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="${file.name.replace(/"/g, "")}"\r\nContent-Type: ${file.type}\r\n\r\n`);
  const data = base64ToBytes(file.base64);
  const tail = enc.encode(`\r\n--${boundary}--\r\n`);
  const all = new Uint8Array(head.length + data.length + tail.length);
  all.set(head, 0);
  all.set(data, head.length);
  all.set(tail, head.length + data.length);
  return { contentType: `multipart/form-data; boundary=${boundary}`, bodyBase64: bytesToBase64(all) };
}

export const uploadId = (id: string) => `bi-upload-${id}`;
export const saveId = (id: string) => `bi-save-${id}`;

/** sent: on the server. refused: rejected for good. retry: back to the in-app queue. */
export function outcomeFor(status: number): "sent" | "refused" | "retry" {
  if (status >= 200 && status < 300) return "sent";
  if (status === 401 || status === 408 || status === 429 || status === 0 || status >= 500) return "retry";
  return "refused";
}

export async function handOffToBackground(): Promise<number> {
  if (!available()) return 0;
  const uploads = (await readQueue()).filter((q) => !q.handedAt);
  const saves = (await readOutbox()).filter((i) => !i.handedAt);
  if (!uploads.length && !saves.length) return 0;
  const token = await refreshSessionForBackground(apiRoot());
  if (!token) return 0;
  const auth = { Authorization: `Bearer ${token}` };
  let handed = 0;
  for (const item of uploads as QueuedUpload[]) {
    const comma = item.dataUrl.indexOf(",");
    const { contentType, bodyBase64 } = multipartBody({ name: item.filename, type: item.mimeType, base64: comma >= 0 ? item.dataUrl.slice(comma + 1) : item.dataUrl });
    try {
      await BackgroundSync.enqueue({ id: uploadId(item.id), url: `${apiRoot()}/applicants/contract/upload`, method: "POST", contentType, bodyBase64, headers: auth });
      await setUploadHanded(item.id, Date.now());
      handed += 1;
    } catch { /* stays in the in-app queue */ }
  }
  for (const save of saves) {
    try {
      await BackgroundSync.enqueue({ id: saveId(save.id), url: `${apiRoot()}${save.path}`, method: "POST", contentType: "application/json", bodyBase64: bytesToBase64(new TextEncoder().encode(save.body)), headers: auth });
      await setOutboxHanded(save.id, Date.now());
      handed += 1;
    } catch { /* stays in the outbox */ }
  }
  return handed;
}

export async function reconcileBackground(): Promise<{ sent: number; refused: number; retry: number }> {
  const summary = { sent: 0, refused: 0, retry: 0 };
  if (!available()) return summary;
  let results: Result[] = [];
  try { results = (await BackgroundSync.results()).results ?? []; } catch { return summary; }
  for (const r of results) {
    const outcome = outcomeFor(Number(r.status) || 0);
    summary[outcome] += 1;
    if (r.id.startsWith("bi-upload-")) {
      const id = r.id.slice("bi-upload-".length);
      if (outcome === "retry") await setUploadHanded(id, undefined); else await dequeue(id);
    } else if (r.id.startsWith("bi-save-")) {
      const id = r.id.slice("bi-save-".length);
      if (outcome === "retry") await setOutboxHanded(id, undefined); else await removeOutboxItem(id);
    }
  }
  if (results.length) await BackgroundSync.acknowledge({ ids: results.map((r) => r.id) }).catch((): void => undefined);
  return summary;
}

export async function cancelBackgroundSync(): Promise<void> {
  if (!available()) return;
  await BackgroundSync.cancelAll().catch((): void => undefined);
}
