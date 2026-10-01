/** Timeline span (years), padding at each end (share of the track) and the gap between labels (px). Spec 6a §2.1. */
export const TIMELINE = { from: 1820, to: 1986, pad: 0.04, gap: 6 };

/** Where a year sits on the track, 0–1: linear, so real gaps show. */
export const yearFrac = (year: number) =>
  TIMELINE.pad + (1 - 2 * TIMELINE.pad) * (year - TIMELINE.from) / (TIMELINE.to - TIMELINE.from);

export interface LabelSlot { left: number; row: 0 | 1 }

/** Left edges for one row of labels (in order): each as near centred on its mark as it can be, ≥ gap apart, inside [0, width]. */
function spreadRow(xs: number[], ws: number[], width: number, gap: number): number[] {
  const n = xs.length, left = xs.map((x, i) => x - ws[i] / 2);
  for (let i = 0; i < n; i++) left[i] = Math.max(left[i], i ? left[i - 1] + ws[i - 1] + gap : 0);
  for (let i = n - 1; i >= 0; i--) left[i] = Math.min(left[i], i < n - 1 ? left[i + 1] - gap - ws[i] : width - ws[i]);
  return left;
}

/**
 * Label slots for marks at `xs` (px) with label widths `ws` (px) on a track `width` px wide. One row when they
 * fit, else even labels in row 0 and odd ones in row 1. Zero widths (not measured yet) centre on the marks.
 */
export function layoutLabels(xs: number[], ws: number[], width: number, gap = TIMELINE.gap): LabelSlot[] {
  const all = xs.map((_, i) => i);
  const fits = (idx: number[]) => idx.reduce((s, i) => s + ws[i], 0) + gap * (idx.length - 1) <= width;
  const measured = ws.some((w) => w > 0);
  const rows = !measured || fits(all) ? [all] : [all.filter((i) => i % 2 === 0), all.filter((i) => i % 2 === 1)];
  const out: LabelSlot[] = new Array(xs.length);
  rows.forEach((idx, r) => {
    const left = measured ? spreadRow(idx.map((i) => xs[i]), idx.map((i) => ws[i]), width, gap) : idx.map((i) => xs[i]);
    idx.forEach((i, k) => { out[i] = { left: left[k], row: r as 0 | 1 }; });
  });
  return out;
}

/** Index of the mark nearest `x`. */
export function nearestIndex(x: number, xs: number[]): number {
  let best = 0;
  for (let i = 1; i < xs.length; i++) if (Math.abs(xs[i] - x) < Math.abs(xs[best] - x)) best = i;
  return best;
}
