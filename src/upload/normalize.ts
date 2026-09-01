import { Capacitor } from "@capacitor/core";

export const MAX_UPLOAD_BYTES = 25 * 1024 * 1024;
const EXTENSIONS = new Set(["pdf", "doc", "docx", "png", "jpg", "jpeg"]);
const MIME_BY_EXTENSION: Record<string, string> = {
  pdf: "application/pdf", doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg",
};

export type NativeUploadSource = { name: string; mimeType?: string; size?: number; path: string };

export function validateUpload(file: Pick<File, "name" | "size">): void {
  const extension = file.name.split(".").pop()?.toLowerCase() ?? "";
  if (!EXTENSIONS.has(extension)) throw new Error("unsupported_file_type");
  if (file.size > MAX_UPLOAD_BYTES) throw new Error("file_too_large");
}

export function normalizeBrowserFile(file: File): File { validateUpload(file); return file; }

export async function normalizeNativeSource(source: NativeUploadSource): Promise<File> {
  if (source.size && source.size > MAX_UPLOAD_BYTES) throw new Error("file_too_large");
  const url = source.path.startsWith("file:") ? Capacitor.convertFileSrc(source.path) : source.path;
  const response = await fetch(url);
  if (!response.ok) throw new Error("file_unavailable");
  const blob = await response.blob();
  const extension = source.name.split(".").pop()?.toLowerCase() ?? "";
  const file = new File([blob], source.name, { type: source.mimeType || blob.type || MIME_BY_EXTENSION[extension] || "application/octet-stream" });
  validateUpload(file);
  return file;
}
