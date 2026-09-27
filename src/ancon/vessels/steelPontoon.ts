import * as THREE from 'three';
import { cellRng } from '../../vegetation/rng';
import { CAR_SLOT, type DeckLayout, type VesselSpec } from '../spec';
import { BITT_H, bittXZ, PartBuilder, STEEL, WOOD, type VesselPart } from './common';

const BOTTOM = -0.9, RAKE = 1.2, FOUL_TOP = 0.15, END_BOTTOM = -0.25, SEAM = 0.03, SPLASH = 0.06, FOUL_BOTTOM = -0.3, PANEL_T = 0.03;

/**
 * 1980–86 steel-plate pontoon (research §2.2): welded plate hull with raked ends, deck plating,
 * low curb, rope guides, bitts, hinged steel ramps, a fouling band at the waterline. The idle 1986
 * barge uses the same random draws with more rust (so every panel is darker).
 */
export function buildSteelPontoon(spec: VesselSpec, L: DeckLayout, seed: number): VesselPart[] {
  const r = cellRng(seed, 4, 702), hl = L.halfLength, hb = L.halfBeam, top = L.deckY, rust = spec.moored ? 0.5 : 0.15;
  const steel = new PartBuilder(), iron = new PartBuilder();
  /** ±6 % tone, then a random share (0..k) of rust. Always draws two numbers (same stream for 1984 and 1986). */
  const worn = (base: THREE.Color, k: number) => { const a = r(), b = r(); return base.clone().multiplyScalar(0.94 + 0.12 * a).lerp(STEEL.rust, k * b); };
  const straight = hl - RAKE, shellTop = top - 0.012;
  /** Upright plate: texture v runs up the world (rust drips run down the hull, not along it). */
  const plate = (size: [number, number, number], at: [number, number, number], c: THREE.Color) =>
    steel.add(new THREE.BoxGeometry(size[0], size[1], size[2]).translate(at[0], at[1], at[2]), c, { grain: 'y' });
  // Core shell, 3 cm inside the plating (the plates form the whole outer skin), antifouling below −0.3.
  // Painted WELD-dark: it only shows through the plate seams, which read as dark weld lines.
  steel.box([2 * straight, shellTop - FOUL_BOTTOM, 2 * hb - 0.06], [0, (shellTop + FOUL_BOTTOM) / 2, 0], STEEL.weld);
  steel.box([2 * straight, FOUL_BOTTOM - BOTTOM, 2 * hb - 0.06], [0, (FOUL_BOTTOM + BOTTOM) / 2, 0], STEEL.antifoul);
  // Raked ends: the bottom rises from BOTTOM at |x| = straight to END_BOTTOM at the transom (3 cm inside |x| = hl).
  const xe = hl - PANEL_T;
  for (const sx of [-1, 1]) {
    const pts = [[straight, BOTTOM], [xe, END_BOTTOM], [xe, shellTop], [straight, shellTop]].map(([x, y]) => new THREE.Vector2(sx * x, y));
    steel.add(new THREE.ExtrudeGeometry(new THREE.Shape(pts), { depth: 2 * hb - 0.06, bevelEnabled: false }).translate(0, 0, -(hb - 0.03)), STEEL.antifoul);
  }
  // Side plating: ~2 m panels over the straight middle plus one over each rake, with 3 cm weld seams:
  // SHELL + rust above FOUL_TOP, a fouling strip below it (down to −0.3, or −0.25 over the rake).
  const m = Math.max(1, Math.round((2 * straight) / 2)), pitch = (2 * straight) / m;
  const foul = () => STEEL.foul.clone().multiplyScalar(0.94 + 0.12 * r());
  /** Dried growth at the top of the fouling band (tide/wash line), browner and paler than the wet slime below. */
  const splash = () => STEEL.foul.clone().lerp(STEEL.deck, 0.3).lerp(STEEL.rust, 0.2).multiplyScalar(0.95 + 0.1 * r());
  const cols: [number, number, number][] = [];   // [x centre, length, fouling bottom]
  for (let i = 0; i < m; i++) cols.push([-straight + (i + 0.5) * pitch, pitch, FOUL_BOTTOM]);
  for (const sx of [-1, 1]) cols.push([sx * (straight + RAKE / 2), RAKE, END_BOTTOM]);
  for (const sz of [-1, 1]) for (const [x, len, fb] of cols) {
    const z = sz * (hb - PANEL_T / 2);
    plate([len - SEAM, top - 0.02 - FOUL_TOP, PANEL_T], [x, (top - 0.02 + FOUL_TOP) / 2, z], worn(STEEL.shell, rust));
    plate([len - SEAM, FOUL_TOP - fb, PANEL_T], [x, (FOUL_TOP + fb) / 2, z], foul());
    plate([len - SEAM, SPLASH, PANEL_T + 0.004], [x, FOUL_TOP - SPLASH / 2, z], splash());
  }
  // Transom plating on both ends, same split.
  for (const sx of [-1, 1]) {
    const x = sx * (hl - PANEL_T / 2);
    plate([PANEL_T, top - 0.02 - FOUL_TOP, 2 * hb - SEAM], [x, (top - 0.02 + FOUL_TOP) / 2, 0], worn(STEEL.shell, rust));
    plate([PANEL_T, FOUL_TOP - END_BOTTOM, 2 * hb - SEAM], [x, (FOUL_TOP + END_BOTTOM) / 2, 0], foul());
    plate([PANEL_T + 0.004, SPLASH, 2 * hb - SEAM], [x, FOUL_TOP - SPLASH / 2, 0], splash());
  }
  // Deck plates 1.5 × 3.75 m, butt-welded: the plates touch and the seams are dark weld beads
  // (an open 8 mm gap only shows its sunlit edges as sparkle, and the shadow map cannot darken it). Worn wheel lanes.
  const nx = Math.ceil((2 * hl) / 1.5), nz = Math.max(1, Math.round((2 * hb) / 3.75)), px = (2 * hl) / nx, pz = (2 * hb) / nz;
  for (let i = 0; i < nx; i++) for (let j = 0; j < nz; j++)
    steel.box([px, 0.012, pz], [-hl + (i + 0.5) * px, top - 0.006, -hb + (j + 0.5) * pz], worn(STEEL.deck, rust));
  // Beads and lanes are flat decals (no side faces to catch the grazing sun or fight for depth).
  const decal = (w: number, d: number, x: number, y: number, z: number, c: THREE.Color) =>
    steel.add(new THREE.PlaneGeometry(w, d).rotateX(-Math.PI / 2).translate(x, y, z), c);
  for (let l = 0; l < L.lanes; l++) for (const dz of [-0.8, 0.8])
    decal(2 * hl - 1, 0.5, 0, top + 0.001, (l + 0.5 - L.lanes / 2) * CAR_SLOT.width * 1.08 + dz, STEEL.deck.clone().multiplyScalar(0.8));
  const bead = STEEL.weld.clone().lerp(STEEL.rust, 0.4);
  for (let i = 1; i < nx; i++) decal(0.025, 2 * hb - 0.3, -hl + i * px, top + 0.002, 0, bead);
  for (let j = 1; j < nz; j++) decal(2 * hl - 0.1, 0.025, 0, top + 0.002, -hb + j * pz, bead);
  // Curb along both sides, open at the corners (drainage).
  for (const sz of [-1, 1]) plate([2 * hl - 0.6, 0.2, 0.15], [0, top + 0.1, sz * (hb - 0.075)], worn(STEEL.shell, rust));
  // Rust scabs: irregular blots 1 mm proud of the plating where the paint has failed — hanging from the
  // deck edge on the hull (with a drip tail), along the curbs and ends of the deck (clear of the wheel
  // lanes). A fixed number of candidates always draws the same numbers; the idle barge keeps more of them.
  const keep = spec.moored ? 0.85 : 0.3, scab = () => STEEL.rust.clone().lerp(STEEL.shell, 0.25 * r()).multiplyScalar(0.5 + 0.3 * r());
  /** Blot in the XY plane (normal +Z): top edge near y = 0, hanging down to −h, a drip tail at the bottom. Draws 8 numbers. */
  const blot = (w: number, h: number) => {
    const j = Array.from({ length: 8 }, () => r()), pts: THREE.Vector2[] = [];
    for (let k = 0; k < 8; k++) {
      const t = (k / 8) * 2 * Math.PI, f = 0.65 + 0.5 * j[k];
      pts.push(new THREE.Vector2((w / 2) * f * Math.cos(t), -0.3 * h + 0.3 * h * f * Math.sin(t)));
      if (k === 5) pts.push(new THREE.Vector2(w * 0.2 * (j[0] - 0.5), -h));   // between the 225° and 270° points
    }
    return new THREE.ShapeGeometry(new THREE.Shape(pts));
  };
  for (let i = 0; i < 56; i++) {
    const sz = r() < 0.5 ? -1 : 1, x = (2 * r() - 1) * (hl - 0.2), w = 0.06 + 0.3 * r(), h = 0.12 + 0.35 * r(), drop = r() < 0.6 ? 0 : 0.3 * r(), c = scab();
    const g = blot(w, Math.min(h, top - 0.05 - drop - FOUL_TOP));   // the tail stays above the fouling band
    if (r() < keep) steel.add(g.rotateY(sz > 0 ? 0 : Math.PI).translate(x, top - 0.02 - drop, sz * (hb + 0.001)), c, { grain: 'y' });
    else g.dispose();
  }
  for (let i = 0; i < 36; i++) {
    const sz = r() < 0.5 ? -1 : 1, x = (2 * r() - 1) * (hl - 0.2), w = 0.3 + 1.0 * r(), d = 0.2 + 0.4 * r(), c = scab();
    const z = sz * (hb - 0.2 - d / 2 - 0.3 * r()), g = blot(w, d);
    if (r() < keep) steel.add(g.rotateX(-Math.PI / 2).translate(x, top + 0.001, z - 0.45 * d), c);
    else g.dispose();
  }
  // Rope guides (kept on the idle barge): post pair + roller, roller top at guideY — same place as the wooden guides.
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    for (const dz of [0.16, -0.16]) steel.box([0.12, L.guideY - top + 0.05, 0.12], [sx * (hl - 0.3), (top + L.guideY) / 2, sz * L.ropeZ + dz], STEEL.shell);
    iron.cylinder(0.08, 0.08, 0.34, [sx * (hl - 0.3), L.guideY - 0.08, sz * L.ropeZ], WOOD.iron, 'z', 10);
  }
  // Bitts at bittXZ (the 1986 mooring lines start at the east pair's tops).
  for (const end of [-1, 1] as const) for (const side of [-1, 1] as const) {
    const [bx, bz] = bittXZ(L, end, side);
    iron.cylinder(0.1, 0.1, BITT_H, [bx, top + BITT_H / 2, bz], WOOD.iron, 'y', 8);
  }
  const parts: VesselPart[] = [{ material: 'steel', geometry: steel.build() }, { material: 'iron', geometry: iron.build() }];
  // Hinged steel ramps with anti-slip bars and hinge knuckles.
  for (const end of [-1, 1] as const) {
    const a = new PartBuilder(), x0 = end * hl, y = top - 0.05;
    a.box([L.apron, 0.1, 2 * hb - 1.0], [x0 + (end * L.apron) / 2, y, 0], worn(STEEL.deck, rust));
    for (let i = 0; i < 6; i++) a.box([0.04, 0.03, 2 * hb - 1.1], [x0 + end * (i + 0.5) * (L.apron / 6), y + 0.065, 0], STEEL.shell);
    for (const dz of [-(hb - 1.2), hb - 1.2]) a.cylinder(0.07, 0.07, 0.5, [x0, y, dz], WOOD.iron, 'z', 8);
    parts.push({ material: 'steel', geometry: a.build(), apron: { end, hinge: [x0, y] } });
  }
  return parts;
}
