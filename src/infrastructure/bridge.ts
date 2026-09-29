import type { BridgeState } from '../data/eras';
import type { XZ } from '../data/geo/types';
import { WATER } from '../terrain/fields';
import type { Builders, GroundAt } from './parts';

/**
 * The PR-187 bridge, "Puente de la Restauración" (spec 4a §2): on the OSM line (way 204521442, S26),
 * reinforced concrete (S1), built in the early 1980s next to the station (S4), in service by 1986 (S1;
 * S3 gives 1985). Span length, width,
 * height and pier layout are inferred (L). 1984: every pier stands, the deck covers both ends and a
 * gap stays open over the middle of the river, with timber forms, flags and one crane. 1986: whole,
 * with parapets and street lamps. Medium detail: always ≥ ~150 m from the ferry.
 */
export const BRIDGE = { span: 30, width: 11, thick: 1.2, midY: 7.5, endLift: 0.3, parapet: 0.8, colSpread: 3, colR: 0.6, lampH: 8 } as const;
export interface BridgeSpan { t0: number; t1: number; built: boolean }
export interface BridgePlan { a: XZ; b: XZ; len: number; dir: XZ; yaw: number; ends: [number, number]; spans: BridgeSpan[] }

const GREY = 0xb3aea4, ASPHALT = 0x3a3a3a, FORM = 0x8a6f4c, CRANE = 0xc9a227, RED = 0xb3261e, LAMP = 0x5a5d60;

export function bridgePlan(way: readonly XZ[], state: BridgeState, waterAt: (x: number, z: number) => number, groundAt: GroundAt): BridgePlan | null {
  if (state === 'none') return null;
  const a = way[0], b = way[way.length - 1], len = Math.hypot(b[0] - a[0], b[1] - a[1]);
  const dir: XZ = [(b[0] - a[0]) / len, (b[1] - a[1]) / len];
  const n = Math.max(1, Math.round(len / BRIDGE.span));
  const spans: BridgeSpan[] = Array.from({ length: n }, (_, i) => ({ t0: i / n, t1: (i + 1) / n, built: true }));
  if (state === 'building') {
    let rs = -1, re = -1;
    for (let d = 0; d <= len; d += 1) if (waterAt(a[0] + dir[0] * d, a[1] + dir[1] * d) === WATER.RIVER) { if (rs < 0) rs = d; re = d; }
    if (rs >= 0) {
      const mid = (rs + re) / 2 / len, half = Math.max((0.2 * (re - rs)) / len, 0.5 / n);
      for (const s of spans) if (Math.abs((s.t0 + s.t1) / 2 - mid) < half) s.built = false;
      spans[0].built = true; spans[n - 1].built = true;
    }
  }
  return { a, b, len, dir, yaw: Math.atan2(-dir[1], dir[0]), ends: [groundAt(a[0], a[1]), groundAt(b[0], b[1])], spans };
}

export function deckTop(p: BridgePlan, t: number) {
  const end = p.ends[0] + (p.ends[1] - p.ends[0]) * t + BRIDGE.endLift;
  return end + (BRIDGE.midY - end) * Math.sin(Math.PI * t);
}

/** World point at bridge parameter t and lateral offset v (local +Z). */
const at = (p: BridgePlan, t: number, v: number): [number, number] =>
  [p.a[0] + p.dir[0] * p.len * t - p.dir[1] * v, p.a[1] + p.dir[1] * p.len * t + p.dir[0] * v];

export function buildBridge(b: Builders, p: BridgePlan, state: BridgeState, groundAt: GroundAt) {
  const W = BRIDGE.width, n = p.spans.length;
  // Deck spans (straight, tilted segments of the arched profile) with an asphalt top.
  for (const s of p.spans) {
    if (!s.built) continue;
    const tm = (s.t0 + s.t1) / 2, l = (s.t1 - s.t0) * p.len, y0 = deckTop(p, s.t0), y1 = deckTop(p, s.t1), tilt = Math.atan2(y1 - y0, l);
    const [x, z] = at(p, tm, 0), y = (y0 + y1) / 2;
    b.concrete.box([l + 0.05, BRIDGE.thick, W], [x, y - BRIDGE.thick / 2, z], GREY, tilt, p.yaw);
    b.concrete.box([l + 0.05, 0.06, W - 1.4], [x, y + 0.03, z], ASPHALT, tilt, p.yaw);
    if (state === 'open') for (const side of [-1, 1]) {
      const [px, pz] = at(p, tm, side * (W / 2 - 0.15));
      b.concrete.box([l + 0.05, BRIDGE.parapet, 0.3], [px, y + BRIDGE.parapet / 2, pz], GREY, tilt, p.yaw);
    }
  }
  // Piers at every inner span joint: two round columns and a cap beam, from 0.5 m under the ground or riverbed.
  for (let k = 1; k < n; k++) {
    const t = k / n, top = deckTop(p, t) - BRIDGE.thick;
    for (const side of [-1, 1]) {
      const [x, z] = at(p, t, side * BRIDGE.colSpread), gy = groundAt(x, z) - 0.5;
      b.concrete.cylinder(BRIDGE.colR, BRIDGE.colR, top - gy, [x, (top + gy) / 2, z], GREY, 'y', 12);
    }
    const [x, z] = at(p, t, 0);
    b.concrete.box([1.4, 1.0, W - 1], [x, top - 0.5, z], GREY, 0, p.yaw);
    if (state === 'open' && k % 2 === 0) {   // street lamps every other joint, alternating sides
      const side = (k / 2) % 2 ? 1 : -1, [lx, lz] = at(p, t, side * (W / 2 - 0.4)), y = deckTop(p, t);
      b.iron.cylinder(0.08, 0.1, BRIDGE.lampH, [lx, y + BRIDGE.lampH / 2, lz], LAMP, 'y', 6);
      const [hx, hz] = at(p, t, side * (W / 2 - 1.6));
      b.iron.box([0.35, 0.18, 2.4], [hx, y + BRIDGE.lampH, hz], LAMP, 0, p.yaw);
    }
  }
  // Abutments.
  for (const t of [0, 1]) {
    const [x, z] = at(p, t, 0), y = deckTop(p, t);
    b.concrete.box([3, 2.2, W], [x, y - 1.1, z], GREY, 0, p.yaw);
  }
  if (state === 'building') buildWorks(b, p, groundAt);
}

/** 1984: timber forms and falsework at the gap's piers, flags at the deck ends, one crawler crane. */
function buildWorks(b: Builders, p: BridgePlan, groundAt: GroundAt) {
  const n = p.spans.length, gap = p.spans.map((s, i) => (s.built ? -1 : i)).filter((i) => i >= 0);
  if (!gap.length) return;
  const edges = [gap[0], gap[gap.length - 1] + 1];   // joints at the two sides of the gap
  for (const k of edges) {
    const t = k / n, top = deckTop(p, t) - BRIDGE.thick, [x, z] = at(p, t, 0);
    b.wood.box([2.2, 1.6, BRIDGE.width], [x, top + 0.3, z], FORM, 0, p.yaw);
    for (const dv of [-4.5, -1.5, 1.5, 4.5]) for (const dt of [-1, 1]) {
      const [fx, fz] = at(p, t + (dt * 1.2) / p.len, dv), gy = groundAt(fx, fz) - 0.3;
      b.wood.box([0.18, top - gy, 0.18], [fx, (top + gy) / 2, fz], FORM, 0, p.yaw);
    }
    for (const side of [-1, 1]) {   // flags on the built deck end
      const tt = t + ((k === edges[0] ? -1 : 1) * 2) / p.len, [fx, fz] = at(p, tt, side * (BRIDGE.width / 2 - 0.5)), y = deckTop(p, tt);
      b.iron.cylinder(0.03, 0.03, 2.2, [fx, y + 1.1, fz], LAMP, 'y', 5);
      const [gx, gz] = at(p, tt + 0.45 / p.len, side * (BRIDGE.width / 2 - 0.5));
      b.iron.box([0.9, 0.55, 0.02], [gx, y + 1.9, gz], RED, 0, p.yaw);
    }
  }
  // Crawler crane on the deck before the gap, boom leaning out over it.
  const tc = (edges[0] - 0.35) / n, [cx, cz] = at(p, tc, 0), y = deckTop(p, tc);
  b.iron.box([4.5, 2.2, 3.2], [cx, y + 1.5, cz], CRANE, 0, p.yaw);
  for (const side of [-1, 1]) { const [tx, tz] = at(p, tc, side * 1.4); b.iron.box([5, 0.8, 0.7], [tx, y + 0.4, tz], 0x2b2826, 0, p.yaw); }
  const boom = 24, ang = 0.95, bx = Math.cos(ang) * boom, by = Math.sin(ang) * boom;
  for (const dv of [-0.45, 0.45]) for (const dy of [0, 0.7]) {
    const [x, z] = at(p, tc + bx / 2 / p.len, dv);
    b.iron.box([boom, 0.12, 0.12], [x, y + 2.6 + dy + by / 2, z], CRANE, ang, p.yaw);
  }
  for (let k = 1; k < 12; k++) {   // lacing
    const u = (k / 12) * boom, [x, z] = at(p, tc + (Math.cos(ang) * u) / p.len, 0);
    b.iron.box([0.08, 0.8, 0.95], [x, y + 2.95 + Math.sin(ang) * u, z], CRANE, ang, p.yaw);
  }
  const [hx, hz] = at(p, tc + bx / p.len, 0);
  b.iron.box([0.04, 10, 0.04], [hx, y + 2.6 + by - 5, hz], 0x2b2826, 0, p.yaw);   // hook line
}

/** Points within `half` m of the bridge line, between its ends (woody plants are kept out, Task 10). */
export function bridgeCorridor(way: readonly XZ[], half: number) {
  const a = way[0], b = way[way.length - 1], dx = b[0] - a[0], dz = b[1] - a[1], len = Math.hypot(dx, dz), ux = dx / len, uz = dz / len;
  return (x: number, z: number) => {
    const px = x - a[0], pz = z - a[1], t = px * ux + pz * uz;
    return t >= 0 && t <= len && Math.abs(-px * uz + pz * ux) <= half;
  };
}
