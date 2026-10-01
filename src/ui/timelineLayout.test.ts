import { expect, test } from 'vitest';
import { ERA_IDS } from '../data/eras';
import { layoutLabels, nearestIndex, TIMELINE, yearFrac } from './timelineLayout';

test('year → fraction is linear between the padded ends', () => {
  expect(yearFrac(TIMELINE.from)).toBeCloseTo(TIMELINE.pad, 12);
  expect(yearFrac(TIMELINE.to)).toBeCloseTo(1 - TIMELINE.pad, 12);
  const a = yearFrac(1840), b = yearFrac(1900), c = yearFrac(1960);
  expect(b - a).toBeCloseTo(c - b, 12);
});
test('the eras are in order and 1840→1900 is much longer than 1984→1986', () => {
  const f = ERA_IDS.map((id) => yearFrac(Number(id)));
  for (let i = 1; i < f.length; i++) expect(f[i]).toBeGreaterThan(f[i - 1]);
  expect((f[1] - f[0]) / (f[7] - f[6])).toBeCloseTo(30, 6);
});

const W = 880, xs = ERA_IDS.map((id) => yearFrac(Number(id)) * W);
const noOverlap = (slots: { left: number; row: number }[], ws: number[], gap: number) => {
  for (const row of [0, 1]) {
    const r = slots.map((s, i) => ({ ...s, w: ws[i] })).filter((s) => s.row === row).sort((a, b) => a.left - b.left);
    for (let i = 1; i < r.length; i++) expect(r[i].left).toBeGreaterThanOrEqual(r[i - 1].left + r[i - 1].w + gap - 1e-9);
    for (const s of r) { expect(s.left).toBeGreaterThanOrEqual(-1e-9); expect(s.left + s.w).toBeLessThanOrEqual(W + 1e-9); }
  }
};

test('narrow labels fit one row, in order, without overlap, each as near its mark as the others allow', () => {
  const ws = xs.map(() => 56), slots = layoutLabels(xs, ws, W);
  expect(slots.every((s) => s.row === 0)).toBe(true);
  noOverlap(slots, ws, TIMELINE.gap);
  for (let i = 1; i < slots.length; i++) expect(slots[i].left).toBeGreaterThan(slots[i - 1].left);
  expect(slots[1].left + 28).toBeCloseTo(xs[1], 6);   // 1900 has room: centred on its mark
});
test('wide labels that do not fit one row go in two rows (even / odd), still without overlap', () => {
  const ws = xs.map(() => 140), slots = layoutLabels(xs, ws, W);
  expect(slots.map((s) => s.row)).toEqual([0, 1, 0, 1, 0, 1, 0, 1]);
  noOverlap(slots, ws, TIMELINE.gap);
});
test('zero widths (not measured yet) centre every label on its mark', () => {
  const slots = layoutLabels(xs, xs.map(() => 0), W);
  slots.forEach((s, i) => expect(s.left).toBeCloseTo(xs[i], 9));
});
test('nearestIndex snaps to the closest mark', () => {
  expect(nearestIndex(-50, xs)).toBe(0);
  expect(nearestIndex(xs[3] + 1, xs)).toBe(3);
  expect(nearestIndex(W + 50, xs)).toBe(7);
});
