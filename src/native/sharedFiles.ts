// BI_CLIENT_BLOCK_v554_SHARE_TO_BOREAL
// An applicant shares their subcontract to Boreal Risk from Mail, Files or
// Photos. iOS hands us a file:// URL through appUrlOpen (the app is registered
// for PDF/Word/images); Android's SharedFilesPlugin copies ACTION_SEND streams
// into the cache and returns them from take(). The file waits here until the
// upload page picks it up and sends it through the normal contract upload.
import { Capacitor, registerPlugin } from "@capacitor/core";

export type SharedSource = { path: string; name: string; mimeType: string };
interface SharedFilesPlugin { take(): Promise<{ files: SharedSource[] }>; }
const SharedFiles = registerPlugin<SharedFilesPlugin>("SharedFiles");

export const SHARED_EVENT = "boreal:shared-files";
const pending: SharedSource[] = [];

const MIME: Record<string, string> = {
  pdf: "application/pdf", doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", heic: "image/heic",
};

export function isSharedFileUrl(url: unknown): url is string {
  return typeof url === "string" && /^(file|content):\/\//i.test(url.trim());
}

export function fileNameFromUrl(url: string): string {
  try {
    return decodeURIComponent(new URL(url).pathname.split("/").filter(Boolean).pop() ?? "") || "contract";
  } catch {
    return "contract";
  }
}

export function mimeFor(name: string, fallback?: string): string {
  return MIME[(name.split(".").pop() ?? "").toLowerCase()] ?? (fallback || "application/octet-stream");
}

export function holdShared(sources: SharedSource[]): void {
  if (!sources.length) return;
  pending.push(...sources);
  window.dispatchEvent(new Event(SHARED_EVENT));
}

export function holdSharedUrl(url: string): void {
  const name = fileNameFromUrl(url);
  holdShared([{ path: url, name, mimeType: mimeFor(name) }]);
}

export function takeShared(): SharedSource | null {
  return pending.shift() ?? null;
}

/** Android only; resolves to how many files arrived. */
export async function collectAndroidShares(): Promise<number> {
  if (!Capacitor.isNativePlatform() || !Capacitor.isPluginAvailable("SharedFiles")) return 0;
  try {
    const { files } = await SharedFiles.take();
    const list = (files ?? []).map((f) => ({ ...f, mimeType: mimeFor(f.name, f.mimeType) }));
    holdShared(list);
    return list.length;
  } catch {
    return 0;
  }
}
