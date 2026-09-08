import { Capacitor } from "@capacitor/core";
import { DocumentScanner } from "@capacitor-mlkit/document-scanner";

async function readNativeAsset(value: string): Promise<Blob> {
  if (value.startsWith("data:")) return fetch(value).then((response) => response.blob());
  const response = await fetch(Capacitor.convertFileSrc(value));
  if (!response.ok) throw new Error("Unable to read scanned page");
  return response.blob();
}

const encoder = new TextEncoder();

function join(parts: Uint8Array[]): Uint8Array {
  const length = parts.reduce((total, part) => total + part.length, 0);
  const output = new Uint8Array(length);
  let offset = 0;
  for (const part of parts) {
    output.set(part, offset);
    offset += part.length;
  }
  return output;
}

async function asJpeg(blob: Blob) {
  const bitmap = await createImageBitmap(blob);
  const canvas = document.createElement("canvas");
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Unable to prepare scanned page");
  context.drawImage(bitmap, 0, 0);
  bitmap.close();
  const jpeg = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (result) => result ? resolve(result) : reject(new Error("Unable to encode scanned page")),
      "image/jpeg",
      0.9,
    );
  });
  return {
    bytes: new Uint8Array(await jpeg.arrayBuffer()),
    width: canvas.width,
    height: canvas.height,
  };
}

async function imagesToPdf(images: string[]): Promise<Blob> {
  const pages = await Promise.all(images.map(async (image) => asJpeg(await readNativeAsset(image))));
  if (pages.length === 0) throw new Error("The scan did not contain any pages");

  const objectCount = 2 + pages.length * 3;
  const objects: Array<Uint8Array | undefined> = new Array(objectCount + 1);
  const pageIds = pages.map((_, index) => 3 + index * 3);
  objects[1] = encoder.encode("<< /Type /Catalog /Pages 2 0 R >>");
  objects[2] = encoder.encode(`<< /Type /Pages /Count ${pages.length} /Kids [${pageIds.map((id) => `${id} 0 R`).join(" ")}] >>`);

  pages.forEach((page, index) => {
    const pageId = pageIds[index];
    const imageId = pageId + 1;
    const contentId = pageId + 2;
    const width = 612;
    const height = Math.round(width * page.height / page.width);
    objects[pageId] = encoder.encode(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${width} ${height}] /Resources << /XObject << /Im${index} ${imageId} 0 R >> >> /Contents ${contentId} 0 R >>`);
    objects[imageId] = join([
      encoder.encode(`<< /Type /XObject /Subtype /Image /Width ${page.width} /Height ${page.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${page.bytes.length} >>\nstream\n`),
      page.bytes,
      encoder.encode("\nendstream"),
    ]);
    const draw = `q ${width} 0 0 ${height} 0 0 cm /Im${index} Do Q`;
    objects[contentId] = encoder.encode(`<< /Length ${encoder.encode(draw).length} >>\nstream\n${draw}\nendstream`);
  });

  const output: Uint8Array[] = [encoder.encode("%PDF-1.4\n%\xE2\xE3\xCF\xD3\n")];
  const offsets = new Array<number>(objectCount + 1).fill(0);
  let offset = output[0].length;
  for (let id = 1; id <= objectCount; id += 1) {
    const object = join([encoder.encode(`${id} 0 obj\n`), objects[id]!, encoder.encode("\nendobj\n")]);
    offsets[id] = offset;
    output.push(object);
    offset += object.length;
  }
  const xref = offset;
  output.push(encoder.encode(`xref\n0 ${objectCount + 1}\n0000000000 65535 f \n`));
  for (let id = 1; id <= objectCount; id += 1) {
    output.push(encoder.encode(`${String(offsets[id]).padStart(10, "0")} 00000 n \n`));
  }
  output.push(encoder.encode(`trailer\n<< /Size ${objectCount + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`));
  return new Blob(output as BlobPart[], { type: "application/pdf" });
}

export async function scanContractAsPdf(): Promise<File | null> {
  if (!Capacitor.isNativePlatform()) return null;
  const result = await DocumentScanner.scanDocument({ pageLimit: 10 });
  const pdf = await imagesToPdf(result.scannedImages ?? []);
  return new File([pdf], "contract-scan.pdf", { type: "application/pdf" });
}
