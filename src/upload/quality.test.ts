// BI_CLIENT_BLOCK_v092_CAPTURE_POLISH_v1
import { describe, expect, it } from "vitest";
import { evaluate, laplacianVariance, toGrayscale, MIN_SHARPNESS } from "./quality";

describe("quality evaluation", () => {
  it("flags low resolution", () => {
    expect(evaluate(600, 800, 200).issues).toContain("too_small");
  });
  it("flags blur", () => {
    expect(evaluate(2000, 3000, 10).issues).toContain("too_blurry");
  });
  it("flags a cropped-looking aspect ratio", () => {
    expect(evaluate(4000, 500, 200).issues).toContain("extreme_aspect");
  });
  it("passes a clean capture", () => {
    const report = evaluate(2400, 3200, MIN_SHARPNESS + 50);
    expect(report.ok).toBe(true);
    expect(report.issues).toEqual([]);
  });
});

describe("laplacian variance", () => {
  it("is near zero on a flat image and high on a sharp edge", () => {
    const flat = new Uint8ClampedArray(20 * 20).fill(128);
    expect(laplacianVariance(flat, 20, 20)).toBeLessThan(1);

    const edged = new Uint8ClampedArray(20 * 20);
    for (let y = 0; y < 20; y += 1) for (let x = 0; x < 20; x += 1) edged[y * 20 + x] = x < 10 ? 0 : 255;
    expect(laplacianVariance(edged, 20, 20)).toBeGreaterThan(100);
  });

  it("converts RGBA to luminance", () => {
    const rgba = new Uint8ClampedArray([255, 255, 255, 255, 0, 0, 0, 255]);
    const gray = toGrayscale(rgba);
    expect(gray.length).toBe(2);
    expect(gray[0]).toBe(255);
    expect(gray[1]).toBe(0);
  });
});
