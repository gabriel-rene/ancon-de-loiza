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
import { createFaunaPose, type FaunaPose } from './pose';
import { faunaSite, type FaunaWorld } from './site';
import { wader, waderSpecs } from './waders';
import { manatee, manateeTime, MANATEE, mullet } from './waterLife';

/** An era's fauna world on the 512 placement fields, with its own dock timings. */
export function worldFor(id: EraId): FaunaWorld {
  const e = getEra(id), f = fields512(e.river.bankOffset.value);
  const spec = vesselSpec(e, eraTimings(e));
  return { site: faunaSite(f, (x, z) => sampleField(f, f.height, x, z)), T: spec.timings, moored: spec.moored };
}

/** The app's un-orbited ride camera (App.tsx fov 42, near 1.5, far 40000; desktop 1440×900 ≈ 1.6 aspect). */
export const VIEW = { fov: 42, aspect: 1.6, near: 1.5, far: 40000, maxDist: 400 };
export type ViewKind = 'frigate' | 'pelican' | 'wader' | 'mullet' | 'manatee';
export type ViewFractions = Record<ViewKind, number>;

/**
 * Share of the ride view's time each kind is framed (spec 5 §1.1 amendment): over two full legs sampled every
 * 1 s, the fraction of samples with at least one animal of that kind inside the frustum and within 400 m of
 * the camera (occlusion ignored; high-tier counts). Manatee: the fraction of its surfacings in the window
 * that are framed at mid-roll (p = 0.5).
 */
export function rideViewFractions(id: EraId): ViewFractions {
  const e = getEra(id), f = fields512(e.river.bankOffset.value), groundAt = (x: number, z: number) => sampleField(f, f.height, x, z);
  const spec = vesselSpec(e, eraTimings(e)), w: FaunaWorld = { site: faunaSite(f, groundAt), T: spec.timings, moored: spec.moored };
  const ctx = makePoseContext(geom512(e.river.bankOffset.value), spec, e.river.flow.value, groundAt);
  const counts = QUALITY.high.fauna, waders = waderSpecs(w.site, counts.wadersPerLanding);
  const vp = createVesselPose(), cam = new THREE.PerspectiveCamera(VIEW.fov, VIEW.aspect, VIEW.near, VIEW.far);
  const pos = new THREE.Vector3(), target = new THREE.Vector3(), fr = new THREE.Frustum(), m = new THREE.Matrix4(), v = new THREE.Vector3();
  const o: FaunaPose = createFaunaPose();
  const aim = (clock: number) => {
    computeVesselPose(clock, ctx, vp);
    rideView(vp, ctx.layout, rideYaw(clock, spec.moored, spec.timings), pos, target, groundAt);
    cam.position.copy(pos); cam.lookAt(target); cam.updateMatrixWorld();
    fr.setFromProjectionMatrix(m.multiplyMatrices(cam.projectionMatrix, cam.matrixWorldInverse));
  };
  const seen = (p: FaunaPose) => p.on && fr.containsPoint(v.set(p.x, p.y, p.z)) && v.distanceTo(pos) <= VIEW.maxDist;

  const T0 = 0, T1 = 2 * legDuration(spec.timings);
  const hits: ViewFractions = { frigate: 0, pelican: 0, wader: 0, mullet: 0, manatee: 0 };
  let n = 0;
  for (let c = T0; c < T1; c += 1, n++) {
    aim(c);
    let fg = false, pe = false, wa = false;
    for (let i = 0; i < counts.frigates && !fg; i++) fg = seen(frigate(c, i, w, o));
    for (let i = 0; i < counts.flock && !pe; i++) pe = seen(pelicanFlock(c, i, w, o));
    for (let i = 0; i < counts.fishers && !pe; i++) pe = seen(pelicanFisher(c, i, w, o));
    for (const ws of waders) if (!wa) wa = seen(wader(c, ws, w, o));
    hits.frigate += +fg; hits.pelican += +pe; hits.wader += +wa;
    hits.mullet += +seen(mullet(c, w, o));
  }
  let surf = 0;
  for (let k = Math.floor(T0 / MANATEE.period) - 1; k <= Math.ceil(T1 / MANATEE.period) + 1; k++) {
    const t = manateeTime(k);
    if (t < T0 || t >= T1) continue;
    const c = t + 0.5 * MANATEE.dur;
    aim(c); surf++;
    hits.manatee += +seen(manatee(c, w, o));
  }
  return { frigate: hits.frigate / n, pelican: hits.pelican / n, wader: hits.wader / n, mullet: hits.mullet / n, manatee: surf ? hits.manatee / surf : 0 };
}
