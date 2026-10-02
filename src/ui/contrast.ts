/** WCAG 2 contrast helpers (spec 7b §3.1). Colours are sRGB [r, g, b], 0–255. */
export type RGB = readonly [number, number, number];

/** `#rrggbb`, `rgb(r, g, b)` or `rgba(r, g, b, a)`. */
export function parseColor(css: string): { rgb: RGB; a: number } {
  const s = css.trim();
  const hex = /^#([0-9a-f]{6})$/i.exec(s);
  if (hex) { const n = parseInt(hex[1], 16); return { rgb: [n >> 16, (n >> 8) & 255, n & 255], a: 1 }; }
  const m = /^rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)\s*(?:,\s*([\d.]+)\s*)?\)$/.exec(s);
  if (!m) throw new Error(`unparsed colour: ${css}`);
  return { rgb: [Number(m[1]), Number(m[2]), Number(m[3])], a: m[4] === undefined ? 1 : Number(m[4]) };
}

/** `fg` at alpha `a` over an opaque `bg`. */
export const blend = (fg: RGB, a: number, bg: RGB): RGB =>
  [a * fg[0] + (1 - a) * bg[0], a * fg[1] + (1 - a) * bg[1], a * fg[2] + (1 - a) * bg[2]];

const lin = (c: number) => { const v = c / 255; return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
export const luminance = ([r, g, b]: RGB) => 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);

export function contrastRatio(a: RGB, b: RGB): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}
