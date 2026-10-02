import { expect, test } from 'vitest';
import { createCrossingState, crossingState, CROSSING_TIMINGS } from '../ancon/crossing';
import { HAUL_HZ } from '../ancon/crew';
import { birdCalls, ferryEvents, flushEdges, type FerryFrame, type FerrySpec, type SoundEvent } from './events';

const T = CROSSING_TIMINGS, DT = 1 / 60;
const frame = (clock: number): FerryFrame => {
  const s = crossingState(clock, createCrossingState(), T);
  return { clock, phase: s.phase, tLeg: s.tLeg, effort: s.effort };
};
/** Runs the ferry for `secs` from clock 0 at 60 fps; returns every event. */
function run(spec: FerrySpec, secs: number) {
  const out: SoundEvent[] = [];
  let prev = frame(0);
  for (let c = DT; c < secs; c += DT) { const cur = frame(c); ferryEvents(prev, cur, spec, out); prev = cur; }
  return out;
}
const ropes: FerrySpec = { propulsion: 'ropes', moored: false };
const poles: FerrySpec = { propulsion: 'poles', moored: false };
const leg = T.load + T.castOff + T.cross + T.dock + T.unload;

test('one knock per leg, when the hull meets the landing (dock -> unload)', () => {
  const ev = run(ropes, 2 * leg).filter((e) => e.clip === 'knock');
  expect(ev).toHaveLength(2);
});
test('the knock fires in the frame where the phase becomes unload, not before', () => {
  const at = (c: number) => frame(c);
  const tUnload = T.load + T.castOff + T.cross + T.dock;
  const out: SoundEvent[] = [];
  ferryEvents(at(tUnload - 0.02), at(tUnload - 0.01), ropes, out);
  expect(out.some((e) => e.clip === 'knock')).toBe(false);
  ferryEvents(at(tUnload - 0.01), at(tUnload + 0.01), ropes, out);
  expect(out.filter((e) => e.clip === 'knock')).toHaveLength(1);
});
test('ropes creak 6–10 times per crossing (user: at most 10), never at rest; no poles', () => {
  const ev = run(ropes, leg);
  const creaks = ev.filter((e) => e.clip === 'creak').length;
  expect(creaks).toBeGreaterThanOrEqual(6);
  expect(creaks).toBeLessThanOrEqual(10);
  for (let k = 1; k < 12; k++) {   // every leg, not only the first
    const c = run(ropes, (k + 1) * leg).filter((e) => e.clip === 'creak').length - run(ropes, k * leg).filter((e) => e.clip === 'creak').length;
    expect(c, `leg ${k}`).toBeLessThanOrEqual(10);
  }
  expect(ev.some((e) => e.clip === 'pole')).toBe(false);
});
test('poles (1840–1925): no stroke sound (user 2026-10-02: a steady thump and hiss); the knock stays; no creak', () => {
  const ev = run(poles, 2 * leg);
  expect(ev.map((e) => e.clip)).toEqual(['knock', 'knock']);
});
test('moored (1986): nothing at all', () => {
  expect(run({ ...ropes, moored: true }, 2 * leg)).toEqual([]);
});
test('a jump back or a big step (seek, era reset) fires nothing', () => {
  const out: SoundEvent[] = [];
  ferryEvents(frame(T.load + T.castOff + T.cross - 0.01 + 5), frame(T.load + T.castOff + T.cross + 0.01), ropes, out);
  ferryEvents(frame(T.load + T.castOff + T.cross - 2), frame(T.load + T.castOff + T.cross + 0.01), ropes, out);
  expect(out).toEqual([]);
});
test('bird calls: about one per period, deterministic, valid wader indices, thinned by rate', () => {
  const calls = (rate: number) => { const out: SoundEvent[] = []; for (let t = DT; t < 400; t += DT) birdCalls(t - DT, t, 6, rate, out); return out; };
  const a = calls(1), b = calls(1);
  expect(a).toEqual(b);
  expect(a.length).toBeGreaterThan(80); expect(a.length).toBeLessThan(120);
  expect(a.every((e) => e.index >= 0 && e.index < 6 && e.clip === 'peep')).toBe(true);
  expect(calls(0.2).length).toBeLessThan(a.length * 0.35);
});
test('bird calls: none with no waders or after a jump', () => {
  expect(birdCalls(0, 400, 0, 1, [])).toEqual([]);
  expect(birdCalls(10, 11, 6, 1, [])).toEqual([]);
});
test('flaps fire on a wader going from standing to flying, once', () => {
  const prev = new Uint8Array([0, 1, 0, 0]), cur = new Uint8Array([1, 1, 0, 1]);
  const out = flushEdges(prev, cur, 4, []);
  expect(out.map((e) => [e.clip, e.index])).toEqual([['flap', 0], ['flap', 3]]);
});
