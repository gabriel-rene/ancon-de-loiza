// Shared test fixtures for src/fauna (imported by *.test.ts only).
import * as THREE from 'three';
import { legDuration } from '../ancon/crossing';
import { computeVesselPose, createVesselPose, makePoseContext } from '../ancon/pose';
import { rideView, rideYaw } from '../ancon/rideCamera';
import { fields512, geom512 } from '../ancon/testing';
import { vesselSpec } from '../ancon/spec';
import { getEra, type EraId } from '../data/eras';
import { QUALITY } from '../quality';
import { sampleField } from '../terrain/fields';
import { eraTimings } from '../traffic/schedule';
import { frigate, pelicanFisher, pelicanFlock } from './flyers';
import { lastDockStart } from './clock';
import { createFaunaPose, type FaunaPose } from './pose';
import { faunaSite, type FaunaWorld } from './site';
import { WADER_LOOK, wader, waderSpecs, type WaderSpec } from './waders';
import { manatee, manateeTime, MANATEE, mullet } from './waterLife';

/** An era's fauna world on the 512 placement fields, with its own dock timings. */
export function worldFor(id: EraId): FaunaWorld {
  const e = getEra(id), f = fields512(e.river.bankOffset.value);
  const spec = vesselSpec(e, eraTimings(e));
  return { site: faunaSite(f, (x, z) => sampleField(f, f.height, x, z)), T: spec.timings, moored: spec.moored };
}

/** The app's un-orbited ride camera (App.tsx fov 42, near 1.5, far 40000; desktop 1440×900 ≈ 1.6 aspect, 900 px tall). */
export const VIEW = { fov: 42, aspect: 1.6, near: 1.5, far: 40000, maxDist: 400, surfacings: 300, heightPx: 900 };
/**
 * Spec 5 §1.1 (amendment 2026-09-30, closer): the size (m) each kind is judged by, and the least projected size (px)
 * that counts as seen. Wader size is 1 m × its WADER_LOOK scale; take-off counts flying waders at `takeoffPx`.
 */
export const VIEW_SIZE = { pelican: 2.1, frigate: 2.2, wader: 1.0 };
export const VIEW_PX = { pelican: 25, frigate: 10, wader: 10, takeoff: 8 };
/** Seconds after each dock start over which the flush is sampled (every 0.25 s). */
export const TAKEOFF_WINDOW: [number, number] = [2, 6];
/** Projected size (px) of `size` m at distance `d` m in the ride view. */
export const viewPx = (size: number, d: number) => (size / d / (2 * Math.tan((VIEW.fov * Math.PI) / 360))) * VIEW.heightPx;

export type ViewKind = 'frigate' | 'pelican' | 'wader' | 'mullet' | 'manatee';
export type ViewFractions = Record<ViewKind, number> & {
  /** Per dock in the window: the least number of flying waders seen (≥ takeoff px) over TAKEOFF_WINDOW. */
  takeoff: number[];
  /** Per dock in the window: its clock time and landing. */
  docks: { t: number; landing: 0 | 1 }[];
};

/** The app's un-orbited ride camera over an era's fauna world (512 placement fields, the era's dock timings). */
export function rideCamera(id: EraId) {
  const e = getEra(id), f = fields512(e.river.bankOffset.value), groundAt = (x: number, z: number) => sampleField(f, f.height, x, z);
  const spec = vesselSpec(e, eraTimings(e)), w: FaunaWorld = { site: faunaSite(f, groundAt), T: spec.timings, moored: spec.moored };
  const ctx = makePoseContext(geom512(e.river.bankOffset.value), spec, e.river.flow.value, groundAt);
  const vp = createVesselPose(), cam = new THREE.PerspectiveCamera(VIEW.fov, VIEW.aspect, VIEW.near, VIEW.far);
  const pos = new THREE.Vector3(), target = new THREE.Vector3(), fr = new THREE.Frustum(), m = new THREE.Matrix4(), v = new THREE.Vector3();
  return {
    w, spec, pos,
    /** Point the camera as the ride view does at `clock`. */
    aim(clock: number) {
      computeVesselPose(clock, ctx, vp);
      rideView(vp, ctx.layout, rideYaw(clock, spec.moored, spec.timings), pos, target, groundAt);
      cam.position.copy(pos); cam.lookAt(target); cam.updateMatrixWorld();
      fr.setFromProjectionMatrix(m.multiplyMatrices(cam.projectionMatrix, cam.matrixWorldInverse));
    },
    /** In the frustum and within 400 m; with `px`, also at least `px` tall for an animal `size` m long. */
    seen(p: FaunaPose, size = 0, px = 0) {
      if (!p.on || !fr.containsPoint(v.set(p.x, p.y, p.z))) return false;
      const d = v.distanceTo(pos);
      return d <= VIEW.maxDist && (px === 0 || viewPx(size, d) >= px);
    },
    /** In the frustum at any distance. */
    inFrustum: (p: FaunaPose) => fr.containsPoint(v.set(p.x, p.y, p.z)),
  };
}

/**
 * Share of the ride view's time each kind is seen (spec 5 §1.1 amendments): over two full legs sampled every
 * 1 s, the fraction of samples with at least one animal of that kind inside the frustum, within 400 m of the
 * camera and at least VIEW_PX of its VIEW_SIZE on screen (occlusion ignored; high-tier counts). Mullet: frustum
 * and 400 m only (reported). Manatee: long-run, the fraction of its first 300 surfacings framed at mid-roll
 * (p = 0.5), frustum and 400 m. Take-off: for each dock start in the two legs, the least number of flying waders
 * seen at ≥ VIEW_PX.takeoff over TAKEOFF_WINDOW.
 */
export function rideViewFractions(id: EraId): ViewFractions {
  const { w, spec, aim, seen } = rideCamera(id);
  const counts = QUALITY.high.fauna, waders = waderSpecs(w.site, counts.wadersPerLanding);
  const o: FaunaPose = createFaunaPose();
  const S = VIEW_SIZE, X = VIEW_PX, waderSize = (ws: WaderSpec) => S.wader * WADER_LOOK[ws.kind].scale;

  const L = legDuration(spec.timings), T1 = 2 * L;
  const hits = { frigate: 0, pelican: 0, wader: 0, mullet: 0, manatee: 0 };
  let n = 0;
  for (let c = 0; c < T1; c += 1, n++) {
    aim(c);
    let fg = false, pe = false, wa = false;
    for (let i = 0; i < counts.frigates && !fg; i++) fg = seen(frigate(c, i, w, o), S.frigate, X.frigate);
    for (let i = 0; i < counts.flock && !pe; i++) pe = seen(pelicanFlock(c, i, w, o), S.pelican, X.pelican);
    for (let i = 0; i < counts.fishers && !pe; i++) pe = seen(pelicanFisher(c, i, w, o), S.pelican, X.pelican);
    for (const ws of waders) if (!wa) wa = seen(wader(c, ws, w, o), waderSize(ws), X.wader);
    hits.frigate += +fg; hits.pelican += +pe; hits.wader += +wa;
    hits.mullet += +seen(mullet(c, w, o));
  }
  for (let k = 0; k < VIEW.surfacings; k++) {
    const c = manateeTime(k) + 0.5 * MANATEE.dur;
    aim(c);
    hits.manatee += +seen(manatee(c, w, o));
  }
  // Leg 0 docks west (landing 1), leg 1 docks east (landing 0); the ride camera faces the landing it docks at.
  const docks: { t: number; landing: 0 | 1 }[] = [];
  if (!spec.moored) for (const landing of [1, 0] as const) docks.push({ t: lastDockStart(T1 - 1e-6, spec.timings, landing, false), landing });
  docks.sort((a, b) => a.t - b.t);
  const takeoff = docks.map(({ t }) => {
    let least = Infinity;
    for (let s = TAKEOFF_WINDOW[0]; s <= TAKEOFF_WINDOW[1] + 1e-9; s += 0.25) {
      aim(t + s);
      let k = 0;
      for (const ws of waders) if (wader(t + s, ws, w, o).legs === 1 && seen(o, waderSize(ws), X.takeoff)) k++;
      least = Math.min(least, k);
    }
    return least;
  });
  return {
    frigate: hits.frigate / n, pelican: hits.pelican / n, wader: hits.wader / n, mullet: hits.mullet / n,
    manatee: hits.manatee / VIEW.surfacings, takeoff, docks,
  };
}
