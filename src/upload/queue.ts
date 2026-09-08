// BI_CLIENT_BLOCK_v092_CAPTURE_POLISH_v1
// A backgrounded app loses an in-flight fetch, so the applicant re-shoots a
// contract they already sent. Persist intent, drain on resume.
import { Preferences } from "@capacitor/preferences";

const KEY = "boreal_bi_upload_queue";
const MAX_ATTEMPTS = 5;

export type QueuedUpload = {
  id: string; documentType: string; filename: string; mimeType: string;
  dataUrl: string; attempts: number; queuedAt: number;
};

export async function readQueue(): Promise<QueuedUpload[]> {
  try {
    const { value } = await Preferences.get({ key: KEY });
    const parsed: unknown = value ? JSON.parse(value) : [];
    return Array.isArray(parsed) ? (parsed as QueuedUpload[]) : [];
  } catch { return []; }
}

async function writeQueue(items: QueuedUpload[]): Promise<void> {
  try { await Preferences.set({ key: KEY, value: JSON.stringify(items) }); } catch { /* storage full */ }
}

export async function enqueue(item: Omit<QueuedUpload, "attempts" | "queuedAt">): Promise<void> {
  const queue = await readQueue();
  if (queue.some((q) => q.id === item.id)) return;
  queue.push({ ...item, attempts: 0, queuedAt: Date.now() });
  await writeQueue(queue);
}

export async function dequeue(id: string): Promise<void> {
  await writeQueue((await readQueue()).filter((q) => q.id !== id));
}

/** Attempts are capped so a permanently rejected file cannot retry forever. */
export async function recordFailure(id: string): Promise<"retry" | "abandoned"> {
  const queue = await readQueue();
  const item = queue.find((q) => q.id === id);
  if (!item) return "abandoned";
  item.attempts += 1;
  if (item.attempts >= MAX_ATTEMPTS) {
    await writeQueue(queue.filter((q) => q.id !== id));
    return "abandoned";
  }
  await writeQueue(queue);
  return "retry";
}

export async function drain(send: (item: QueuedUpload) => Promise<void>): Promise<{ sent: number; failed: number }> {
  let sent = 0, failed = 0;
  for (const item of await readQueue()) {
    try { await send(item); await dequeue(item.id); sent += 1; }
    catch { await recordFailure(item.id); failed += 1; }
  }
  return { sent, failed };
}
