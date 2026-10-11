// BI_CLIENT_v789_READABILITY - text colours that sit on light grounds, kept in
// one place so the contrast test checks the values the screens really use.
// Every text/background pair here reaches WCAG AA (4.5:1) for normal text.
export const WHITE = "#ffffff";
export const MIST = "#F5F8FC"; // --boreal-mist, the page ground
export const LINE = "#E4EAF2"; // --boreal-line, also the disabled button fill
export const NAVY = "#0B1F3A"; // --boreal-ink
/** Hints and small print (was #8593aa, 3.2:1 on white). Also --boreal-muted and placeholders in chrome.css. */
export const HINT_TEXT = "#4b5563";
/** Disabled .bi-cta label on LINE (chrome.css). */
export const DISABLED_TEXT = "#374151";
/** Secondary navy text in the action center (was 60-70%). */
export const NAVY_SECONDARY = "rgba(11,31,58,0.75)";
/** The action center's number chip ground. */
export const NAVY_CHIP = "rgba(11,31,58,0.08)";

type Rgba = { r: number; g: number; b: number; a: number };

export function parseColor(value: string): Rgba {
  const v = value.trim().toLowerCase();
  const hex = v.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/);
  if (hex) {
    const h = hex[1].length === 3 ? hex[1].split("").map((c) => c + c).join("") : hex[1];
    return { r: parseInt(h.slice(0, 2), 16), g: parseInt(h.slice(2, 4), 16), b: parseInt(h.slice(4, 6), 16), a: 1 };
  }
  const fn = v.match(/^rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)\s*(?:,\s*([\d.]+)\s*)?\)$/);
  if (fn) return { r: Number(fn[1]), g: Number(fn[2]), b: Number(fn[3]), a: fn[4] === undefined ? 1 : Number(fn[4]) };
  throw new Error(`unsupported colour: ${value}`);
}

/** A translucent colour painted over an opaque one. */
export function over(top: string, bottom: string): string {
  const t = parseColor(top);
  const b = parseColor(bottom);
  const mix = (x: number, y: number) => Math.round(x * t.a + y * (1 - t.a));
  return `rgb(${mix(t.r, b.r)}, ${mix(t.g, b.g)}, ${mix(t.b, b.b)})`;
}

function luminance(color: string): number {
  const { r, g, b } = parseColor(color);
  const lin = (c: number) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

/** WCAG 2.x contrast ratio; a translucent foreground is first painted over the background. */
export function contrastRatio(foreground: string, background: string): number {
  const fg = parseColor(foreground).a < 1 ? over(foreground, background) : foreground;
  const [hi, lo] = [luminance(fg), luminance(background)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}
