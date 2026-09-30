import * as THREE from 'three';
import { expect, test } from 'vitest';
import { legDuration } from '../ancon/crossing';
import { computeVesselPose, createVesselPose, makePoseContext } from '../ancon/pose';
import { geom512 } from '../ancon/testing';
import { vesselSpec } from '../ancon/spec';
import { ERA_IDS, getEra } from '../data/eras';
import { eraTimings } from '../traffic/schedule';
import { lastDockStart } from './clock';
import { createFaunaPose } from './pose';
import { bankValid } from './site';
import { worldFor } from './testing';
import { flightTime, wader, waderHome, waderSpecs, WADE } from './waders';

const w = worldFor('1975'), p = createFaunaPose(), home = [0, 0, 0];
const specs = waderSpecs(w.site, 5);
const L = legDuration(w.T);

test('5 per landing on high, 3 on low; kinds 6 white / 4 dark on high', () => {
  expect(specs.length).toBe(10);
  expect(waderSpecs(w.site, 3).length).toBe(6);
  const white = specs.filter((s) => s.kind === 'great' || s.kind === 'snowy').length;
  expect(white).toBe(6);
  expect(specs.filter((s) => s.flush).length).toBe(8);
});

test('homes and flight targets lie on valid bank samples, at the spec distances', () => {
  for (const s of specs) {
    const b = w.site.banks[s.landing];
    expect(bankValid(b, s.u)).toBe(true);
    expect(bankValid(b, s.u + s.flee)).toBe(true);
    const [lo, hi] = s.flush ? WADE.homeU : WADE.extraU;
    expect(Math.abs(s.u)).toBeGreaterThanOrEqual(lo);
    expect(Math.abs(s.u)).toBeLessThanOrEqual(hi);
    if (s.flush) {
      expect(Math.abs(s.flee)).toBeGreaterThanOrEqual(30);
      expect(Math.abs(s.flee)).toBeLessThanOrEqual(60);
      // Across the front of the pad to the other side, landing at most landMax m from it.
      expect(Math.sign(s.u + s.flee)).toBe(-Math.sign(s.u));
      expect(Math.abs(s.u + s.flee)).toBeLessThanOrEqual(WADE.landMax);
    }
  }
});

test('landing birds take off within 1.5 s of dock start at their landing', () => {
  for (const landing of [0, 1] as const) {
    const d = lastDockStart(3 * L, w.T, landing, false);
    for (const s of specs.filter((x) => x.landing === landing)) {
      waderHome(s, w, home);
      wader(d - 0.1, s, w, p);
      expect(p.legs).toBe(0);
      expect(Math.abs(p.y - home[1])).toBeLessThan(0.3);
      wader(d + 1.6, s, w, p);
      if (s.flush) { expect(p.legs).toBe(1); expect(p.y).toBeGreaterThan(home[1] + 0.1); }
      else expect(p.legs).toBe(0);
    }
  }
});

test('they land 30–60 m away and are home again before the next dock there', () => {
  const d = lastDockStart(3 * L, w.T, 1, false);
  for (const s of specs.filter((x) => x.flush && x.landing === 1)) {
    waderHome(s, w, home);
    const landed = d + s.rank * WADE.stagger + flightTime(s.flee) + 0.01;
    wader(landed, s, w, p);
    const away = Math.hypot(p.x - home[0], p.z - home[2]);
    expect(away).toBeGreaterThanOrEqual(28);
    expect(away).toBeLessThanOrEqual(62);
    wader(d + 2 * L - 0.1, s, w, p);
    expect(Math.hypot(p.x - home[0], p.z - home[2])).toBeLessThanOrEqual(WADE.step + 0.3);
  }
});

test('flush, flight and walk back are continuous (≤ 1 m per 0.1 s)', () => {
  const d = lastDockStart(3 * L, w.T, 0, false), q = createFaunaPose();
  for (const s of specs.filter((x) => x.flush && x.landing === 0)) {
    wader(d - 1, s, w, q);
    for (let c = d - 0.9; c < d + 2 * L; c += 0.1) {
      wader(c, s, w, p);
      expect(Math.hypot(p.x - q.x, p.y - q.y, p.z - q.z), `${s.kind} at ${(c - d).toFixed(1)} s dxz ${Math.hypot(p.x - q.x, p.z - q.z).toFixed(2)} dy ${(p.y - q.y).toFixed(2)} legs ${p.legs}`).toBeLessThanOrEqual(1);
      Object.assign(q, p);
    }
  }
});

test('1986 (moored): never fly', () => {
  const m = worldFor('1986'), ms = waderSpecs(m.site, 5);
  for (let c = 0; c < 1200; c += 0.5) for (const s of ms) {
    wader(c, s, m, p);
    expect(p.legs).toBe(0);
    expect(p.fold).toBe(1);
  }
});

test('same clock, same pose', () => {
  const a = createFaunaPose();
  for (const s of specs) expect(wader(123.4, s, w, p)).toEqual(wader(123.4, s, w, a));
});

test('flush flights pass ≥ 4 m above the deck wherever they cross the docked ferry, in every era', () => {
  const v = new THREE.Vector3(), inv = new THREE.Matrix4(), vp = createVesselPose();
  for (const id of ERA_IDS) {
    const e = getEra(id), ww = worldFor(id);
    if (ww.moored) continue;
    const ctx = makePoseContext(geom512(e.river.bankOffset.value), vesselSpec(e, eraTimings(e)), e.river.flow.value, ww.site.groundAt);
    const lay = ctx.layout, Lw = legDuration(ww.T), ws = waderSpecs(ww.site, 5);
    let over = 0;
    for (const landing of [0, 1] as const) {
      const d = lastDockStart(3 * Lw, ww.T, landing, false);
      for (let s = 0; s <= 14; s += 0.1) {
        computeVesselPose(d + s, ctx, vp); inv.copy(vp.matrix).invert();
        for (const x of ws) {
          if (x.landing !== landing || wader(d + s, x, ww, p).legs !== 1) continue;
          v.set(p.x, p.y, p.z).applyMatrix4(inv);
          if (Math.abs(v.x) > lay.reach + 1 || Math.abs(v.z) > lay.halfBeam + 1) continue;
          over++;
          expect(v.y - lay.deckY, `${id} ${x.kind} +${s.toFixed(1)} s`).toBeGreaterThanOrEqual(4);
        }
      }
    }
    expect(over, id).toBeGreaterThan(0);
  }
});
