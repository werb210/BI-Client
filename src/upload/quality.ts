// BI_CLIENT_BLOCK_v092_CAPTURE_POLISH_v1
// Applicants photograph contracts in bad light and upload 400px blurs that an
// underwriter cannot read, then wait days to be told. Catch it at capture.
// Advisory by design: a false positive that blocks a legitimate upload costs
// more than a bad scan an underwriter can reject.
export type QualityIssue = "too_small" | "too_blurry" | "extreme_aspect";
export type QualityReport = { ok: boolean; issues: QualityIssue[]; sharpness: number; width: number; height: number };

export const MIN_EDGE_PX = 1000;
export const MIN_SHARPNESS = 55;
export const MAX_ASPECT = 4;

/** Laplacian variance — the standard cheap blur metric. Low variance, few edges, blurry. */
export function laplacianVariance(gray: Uint8ClampedArray, width: number, height: number): number {
  if (width < 3 || height < 3) return 0;
  let sum = 0, sumSquares = 0, count = 0;
  for (let y = 1; y < height - 1; y += 1) {
    for (let x = 1; x < width - 1; x += 1) {
      const i = y * width + x;
      const value = -4 * gray[i] + gray[i - 1] + gray[i + 1] + gray[i - width] + gray[i + width];
      sum += value; sumSquares += value * value; count += 1;
    }
  }
  if (!count) return 0;
  const mean = sum / count;
  return sumSquares / count - mean * mean;
}

export function toGrayscale(data: Uint8ClampedArray): Uint8ClampedArray {
  const gray = new Uint8ClampedArray(data.length / 4);
  for (let i = 0, g = 0; i < data.length; i += 4, g += 1) {
    gray[g] = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
  }
  return gray;
}

export function evaluate(width: number, height: number, sharpness: number): QualityReport {
  const issues: QualityIssue[] = [];
  if (Math.min(width, height) < MIN_EDGE_PX) issues.push("too_small");
  if (sharpness < MIN_SHARPNESS) issues.push("too_blurry");
  const aspect = Math.max(width, height) / Math.max(1, Math.min(width, height));
  if (aspect > MAX_ASPECT) issues.push("extreme_aspect");
  return { ok: issues.length === 0, issues, sharpness, width, height };
}

export const ISSUE_MESSAGES: Record<QualityIssue, string> = {
  too_small: "This image is low resolution and may be hard to read.",
  too_blurry: "This looks blurry. Hold steady and try again in better light.",
  extreme_aspect: "Part of the page may be cut off.",
};

export async function assessImage(file: File): Promise<QualityReport | null> {
  if (!file.type.startsWith("image/")) return null;
  try {
    const bitmap = await createImageBitmap(file);
    // Downscale before measuring: sharpness is scale-relative and full-res is slow.
    const scale = Math.min(1, 800 / Math.max(bitmap.width, bitmap.height));
    const w = Math.max(3, Math.round(bitmap.width * scale));
    const h = Math.max(3, Math.round(bitmap.height * scale));
    const canvas = document.createElement("canvas");
    canvas.width = w; canvas.height = h;
    const context = canvas.getContext("2d", { willReadFrequently: true });
    if (!context) { bitmap.close(); return null; }
    context.drawImage(bitmap, 0, 0, w, h);
    const { data } = context.getImageData(0, 0, w, h);
    const sharpness = laplacianVariance(toGrayscale(data), w, h);
    const report = evaluate(bitmap.width, bitmap.height, sharpness);
    bitmap.close();
    return report;
  } catch {
    return null; // Never let the check itself stop an upload.
  }
}
