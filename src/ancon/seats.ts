import * as THREE from 'three';
import { hash3 } from '../vegetation/rng';
import type { VesselPose } from './pose';
import { CAR_SLOT, type DeckLayout, type VesselSpec } from './spec';

export type SeatKind = 'car' | 'cargo' | 'standing';
/** A deck-local anchor (y = deck surface). Future release: a drivable car parks on a 'car' anchor; a first-person camera sits on any anchor. */
export interface SeatAnchor { id: string; kind: SeatKind; pos: [number, number, number]; yaw: number }
const GRID = 0.65, EDGE = 0.45;

/** Deck-local z of the haulers on rope line `side` (+1 / −1): 0.35 m inboard of the rope. */
export const haulerZ = (side: number, L: DeckLayout) => side * (L.ropeZ - 0.35);
/**
 * Deck-local x of rope hauler station k (of `perSide` on the rope line `side`). Stations spread along
 * the deck, but never inside the car slots (Phase 4 parks cars there): a station that would fall
 * inside is moved just past the slot rows, toward its own end (or toward `side` when centred).
 * Shared with the crew choreography (Task 7).
 */
export function haulerStationX(k: number, perSide: number, L: DeckLayout, side: number): number {
  const x = ((k + 0.5) / perSide - 0.5) * L.halfLength, slotHalf = (L.rows * CAR_SLOT.length) / 2;
  if (L.rows === 0 || Math.abs(x) >= slotHalf + 0.45) return x;
  return (x === 0 ? Math.sign(side) : Math.sign(x)) * (slotHalf + 0.45);
}

export function seatAnchors(spec: VesselSpec, L: DeckLayout): SeatAnchor[] {
  const out: SeatAnchor[] = [], rects: [number, number, number, number][] = [];
  const addRect = (x: number, z: number, hx: number, hz: number) => rects.push([x - hx, x + hx, z - hz, z + hz]);
  if (spec.cars > 0) {
    for (let r = 0; r < L.rows; r++) for (let l = 0; l < L.lanes; l++) {
      const idx = r * L.lanes + l;
      if (idx >= spec.cars) break;
      const x = (r + 0.5 - L.rows / 2) * CAR_SLOT.length, z = (l + 0.5 - L.lanes / 2) * CAR_SLOT.width * 1.08;
      out.push({ id: `car${idx}`, kind: 'car', pos: [x, L.deckY, z], yaw: 0 });
      addRect(x, z, CAR_SLOT.length / 2, CAR_SLOT.width / 2);
    }
  } else {
    out.push({ id: 'cargo', kind: 'cargo', pos: [0, L.deckY, 0], yaw: 0 });  // ox cart / animals (Phase 4)
    addRect(0, 0, 1.6, 0.8);
  }
  // Crew space stays free: the rope itself and the hauler stations, the polers' walking lanes
  // along the sides (|z| = halfBeam − 0.45), the helmsman at either end.
  const ropes = spec.propulsion === 'ropes', poles = spec.propulsion === 'poles';
  const zMax = ropes ? L.ropeZ - 0.35 : poles ? L.halfBeam - 0.75 : L.halfBeam - EDGE;
  const xMax = poles ? L.halfLength - 0.35 : L.halfLength - 0.6;
  const perSide = Math.ceil(spec.crew / 2);
  const blocked = (x: number, z: number) =>
    (poles && Math.abs(x) > L.halfLength - 1.2 && Math.abs(z) < 0.75) ||   // the helmsman at either end
    (ropes && Math.abs(z) > L.ropeZ - 1.0 && haulerNear(x, Math.sign(z), perSide, L));
  const cand: { x: number; z: number; h: number }[] = [];
  const EPS = 1e-9;   // strict "inside a slot" test that does not depend on float rounding at the slot edge
  for (let i = 0; ; i++) {
    const x = -L.halfLength + 0.5 + i * GRID;
    if (x > L.halfLength - 0.35 + 1e-9) break;
    for (let j = 0; ; j++) {
      const z = -L.halfBeam + EDGE + j * GRID;
      if (z > L.halfBeam - EDGE + 1e-9) break;
      if (Math.abs(z) > zMax || Math.abs(x) > xMax || blocked(x, z)) continue;
      if (rects.some(([x0, x1, z0, z1]) => x > x0 - EPS && x < x1 + EPS && z > z0 - EPS && z < z1 + EPS)) continue;
      cand.push({ x, z, h: hash3(Math.round(x * 10), Math.round(z * 10), 77) });
    }
  }
  cand.sort((a, b) => a.h - b.h);
  cand.forEach((c, k) => out.push({ id: `stand${k}`, kind: 'standing', pos: [c.x, L.deckY, c.z], yaw: (c.h / 2 ** 32) * 2 * Math.PI - Math.PI }));
  return out;
}

/** A hauler of rope line `side` stands within 0.8 m of x. */
function haulerNear(x: number, side: number, perSide: number, L: DeckLayout) {
  for (let k = 0; k < perSide; k++) if (Math.abs(x - haulerStationX(k, perSide, L, side)) < 0.8) return true;
  return false;
}

export function anchorToWorld(pose: VesselPose, a: SeatAnchor, out: THREE.Matrix4): THREE.Matrix4 {
  return out.makeRotationY(a.yaw).setPosition(a.pos[0], a.pos[1], a.pos[2]).premultiply(pose.matrix);
}
