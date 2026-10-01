import * as THREE from 'three';
import { RIDE_ORBIT, wrapPi } from '../ancon/rideCamera';
import { clamp01, smooth } from '../ancon/ease';
import { landmarkXZ } from '../data/landmarks';
import type { CameraPreset, PublicView } from '../state/url';

export interface ViewPose { pos: [number, number, number]; target: [number, number, number] }

const [ex, ez] = landmarkXZ('eastLanding');
const [wx, wz] = landmarkXZ('westLanding');
const [mx, mz] = landmarkXZ('mouth');

/** Shore's target distance (m): orbiting a target this close turns the view in place (spec 6a §4.3). */
export const LOOK_IN_PLACE = 1;

/** A pose at `pos` looking toward `toward`, with the target LOOK_IN_PLACE ahead of the eye. */
function inPlace(pos: [number, number, number], toward: [number, number, number]): ViewPose {
  const d = new THREE.Vector3(toward[0] - pos[0], toward[1] - pos[1], toward[2] - pos[2]).setLength(LOOK_IN_PLACE);
  return { pos, target: [pos[0] + d.x, pos[1] + d.y, pos[2] + d.z] };
}

export const VIEW_POSES: Record<CameraPreset, ViewPose> = {
  // Fallback for `ride` when the ferry is hidden (?ancon=0): behind and above mid-river, looking at the far landing.
  ride: { pos: [ex * 0.35, 4.2, ez * 0.35], target: [wx, 1.5, wz] },
  // Standing at the Loíza landing, eye height, looking across at the far landing (was `bank`).
  shore: inPlace([ex + 10, 3.6, ez + 8], [wx - 40, 2.5, wz - 30]),
  // High above the river, looking at the crossing (was `aerial`).
  sky: { pos: [520, 380, 640], target: [0, 0, 0] },
  mouth: { pos: [mx - 180, 22, mz + 260], target: [mx, 0, mz] },
  // Dev view (phase 2c): over the west bank, looking south-west across the grassland (cane land).
  fields: { pos: [-500, 170, 250], target: [-1800, 0, 1500] },
  // Dev preset: 150 m out, 60 m up, looking at the farm block centred at (160, -400).
  farm: { pos: [265, 60, -295], target: [160, 0, -400] },
  // Dev view (phase 4a): from the river, looking at the Loíza landing, the station and its road.
  station: { pos: [ex * 0.3, 6, ez * 0.3], target: [ex + 12, 2, ez + 10] },
  // Dev view (phase 4a): from the Loíza bank, looking upstream at the PR-187 bridge line.
  bridge: { pos: [60, 30, 230], target: [-164, 4, 120] },
  // Dev view (phase 4b): low over the river, looking at the Loíza landing, the station and its road.
  town: { pos: [ex * 0.3, 5, ez * 0.3], target: [285, 6, 171] },
};

export interface ControlLimits {
  minPolar: number; maxPolar: number; minDistance: number; maxDistance: number; minZoom: number; maxZoom: number;
  /** camera-controls azimuth/polar rotate speed; negative for Shore so a drag "grabs the world". */
  rotateSpeed: number;
  /** Shore: wheel and pinch zoom the lens instead of dollying. */
  lookInPlace: boolean;
  /** Truck/pan allowed (dev views only). */
  pan: boolean;
}

/** Sky's zoom range: ± this share of its start distance; Shore's lens zoom goes to 1 + this. */
export const VIEW_ZOOM = 0.3;
const distOf = (p: ViewPose) => Math.hypot(p.pos[0] - p.target[0], p.pos[1] - p.target[1], p.pos[2] - p.target[2]);

/** Input limits per view (spec 6a §4.3). `riding`: Ride with the ferry shown (else Ride uses its fixed fallback pose). */
export function controlLimits(view: CameraPreset, riding: boolean): ControlLimits {
  const base = { minZoom: 1, maxZoom: 1, rotateSpeed: 1, lookInPlace: false, pan: false };
  if (view === 'ride' && riding) {
    // A little outside the rig's own limits, so the controls never re-clamp what the rig sets.
    return { ...base, minPolar: RIDE_ORBIT.minPolar - 0.02, maxPolar: RIDE_ORBIT.maxPolar + 0.02, minDistance: 1, maxDistance: 6000 };
  }
  if (view === 'shore') {
    return { ...base, minPolar: 0.4 * Math.PI, maxPolar: 0.56 * Math.PI, minDistance: LOOK_IN_PLACE, maxDistance: LOOK_IN_PLACE,
      maxZoom: 1 + VIEW_ZOOM, rotateSpeed: -0.3, lookInPlace: true };
  }
  if (view === 'sky') {
    const r = distOf(VIEW_POSES.sky);
    return { ...base, minPolar: 0.25 * Math.PI, maxPolar: 0.42 * Math.PI, minDistance: r * (1 - VIEW_ZOOM), maxDistance: r * (1 + VIEW_ZOOM) };
  }
  // Dev views and Ride without the ferry (?ancon=0): the free controls of earlier phases.
  return { ...base, minPolar: 0, maxPolar: Math.PI * 0.495, minDistance: 1, maxDistance: 6000, pan: true };
}

export interface Front { az: number; pol: number; dist: number }
/** The front framing of a pose in camera-controls terms (three.Spherical of pos − target, Y up). */
export function frontOf(p: ViewPose): Front {
  const s = new THREE.Spherical().setFromVector3(new THREE.Vector3(p.pos[0] - p.target[0], p.pos[1] - p.target[1], p.pos[2] - p.target[2]));
  return { az: s.theta, pol: s.phi, dist: s.radius };
}

/** True when the camera has turned, tilted or zoomed away from `f` (spec 6a §4.2: shows Recenter). */
export function isOffFront(f: Front, az: number, pol: number, dist: number, zoom: number): boolean {
  const e = RIDE_ORBIT.frontEps;
  return Math.abs(wrapPi(az - f.az)) > e || Math.abs(pol - f.pol) > e || Math.abs(Math.log(dist / f.dist)) > e || Math.abs(zoom - 1) > e;
}

/** Seconds a view change glides for (spec 6a §4.2). */
export const VIEW_GLIDE_S = 1.5;
/** camera-controls smoothTime: its critically damped glide settles in ~3.3x this, so programmatic moves take ~VIEW_GLIDE_S. */
export const VIEW_SMOOTH_TIME = 0.45;
/** Glide progress 0 → 1 at `seconds` into a view change. */
export const glideK = (seconds: number) => smooth(clamp01(seconds / VIEW_GLIDE_S));

/** Keys 1, 2, 3 (spec 6a §4.2). */
export const VIEW_KEYS: Readonly<Record<string, PublicView>> = { '1': 'ride', '2': 'shore', '3': 'sky' };
