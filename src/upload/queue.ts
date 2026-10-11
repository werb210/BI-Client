// BI_CLIENT_BLOCK_v092_CAPTURE_POLISH_v1
// A backgrounded app loses an in-flight fetch, so the applicant re-shoots a
// contract they already sent. Persist intent, drain on resume.
import { Preferences } from "@capacitor/preferences";
import { seal, unseal } from "@/secure/vault"; // BI_CLIENT_v789_AT_REST_ENCRYPTION

const KEY = "boreal_bi_upload_queue";
const MAX_ATTEMPTS = 5;

export type QueuedUpload = {
  id: string; documentType: string; filename: string; mimeType: string;
  dataUrl: string; attempts: number; queuedAt: number;
  handedAt?: number; // BI_CLIENT_BACKGROUND_SYNC_v308 - the phone is sending it
  applicantId?: string; // BI_CLIENT_v789 - who queued it; only that applicant's session may send it
};

// BI_CLIENT_v789_AT_REST_ENCRYPTION - the queue holds whole contract files, so
// it is stored sealed. A value that does not unseal (old plaintext, or sealed
// under a key forgotten at sign-out) is removed rather than read.
export async function readQueue(): Promise<QueuedUpload[]> {
  try {
    const { value } = await Preferences.get({ key: KEY });
    if (!value) return [];
    const plain = await unseal(value);
    if (plain === null) {
      await Preferences.remove({ key: KEY });
      return [];
    }
    const parsed: unknown = JSON.parse(plain);
    return Array.isArray(parsed) ? (parsed as QueuedUpload[]) : [];
  } catch { return []; }
}

async function writeQueue(items: QueuedUpload[]): Promise<void> {
  try {
    if (items.length === 0) await Preferences.remove({ key: KEY });
    else await Preferences.set({ key: KEY, value: await seal(JSON.stringify(items)) });
  } catch { /* storage full, or no key: nothing is written in plaintext */ }
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

/**
 * BI_CLIENT_v789 - with `applicantId`, only that applicant's uploads are sent;
 * anything queued by someone else (or by an older build that did not record
 * who queued it) is dropped, never sent under the wrong sign-in. `null` means
 * nobody is signed in: nothing is sent and nothing is dropped.
 */
export async function drain(
  send: (item: QueuedUpload) => Promise<void>,
  applicantId?: string | null,
): Promise<{ sent: number; failed: number; dropped: number }> {
  let sent = 0, failed = 0, dropped = 0;
  if (applicantId === null || applicantId === "") return { sent, failed, dropped };
  if (applicantId !== undefined) {
    const queue = await readQueue();
    const mine = queue.filter((q) => q.applicantId === applicantId);
    dropped = queue.length - mine.length;
    if (dropped > 0) await writeQueue(mine);
  }
  for (const item of await readQueue()) {
    if (item.handedAt) continue; // BI_CLIENT_BACKGROUND_SYNC_v308
    try { await send(item); await dequeue(item.id); sent += 1; }
    catch { await recordFailure(item.id); failed += 1; }
  }
  return { sent, failed, dropped };
}

// BI_CLIENT_BACKGROUND_SYNC_v308
export async function setUploadHanded(id: string, handedAt: number | undefined): Promise<void> {
  const queue = await readQueue();
  await writeQueue(queue.map((q) => (q.id === id ? { ...q, handedAt } : q)));
}

/** BI_CLIENT_v789 - sign-out: no contract file stays on the phone. */
export async function clearQueue(): Promise<void> {
  try { await Preferences.remove({ key: KEY }); } catch { /* nothing stored */ }
}
