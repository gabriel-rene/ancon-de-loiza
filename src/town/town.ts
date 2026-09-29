import { CLEAR_INLAND } from '../ancon/geometry';
import type { Era, TownShares } from '../data/eras';
import geo from '../data/geo/loiza.json';
import type { GeoBundle, XZ } from '../data/geo/types';
import { landmarkXZ } from '../data/landmarks';
import { BRIDGE } from '../infrastructure/bridge';
import type { DirtPatch } from '../infrastructure/groundMask';
import type { Footprint } from '../infrastructure/parts';
import { bridgeWay, ROAD_WIDTH, STORY_WAYS, STORY_WIDTH, type SimpleRoad, type StoryId } from '../infrastructure/roads';
import { padPoint } from '../terrain/landingPads';
import { landingPadsFor } from '../terrain/placementFields';
import { cellRng } from '../vegetation/rng';
import { CIRCLE_R, inTownCircle, TOWN_CENTRE } from './constants';
import { churchPlan, churchReach, distToLine, inRing, orientedBox, plazaRing, toLocal, townLots, type ChurchPlan, type Lot, type LotRules } from './layout';

/**
 * One era's town (spec 4b §2): the first houseShare of the lots, each with a look from its fixed number u,
 * the town streets next to them, trodden dirt for yards, church and plaza, and the plaza trees. Pure; cached.
 */
const G = geo as unknown as GeoBundle;

export type HouseLook = 'hut' | 'wood' | 'concrete';
export interface House { id: string; look: HouseLook; fp: Footprint; paint: number }
export interface PlazaTree { species: 'almendro' | 'coconut'; x: number; z: number; rot: number; scale: number; variant: number }
export interface EraTown {
  houses: House[]; streets: SimpleRoad[]; dirt: DirtPatch[];
  church: ChurchPlan; plaza: readonly XZ[]; plazaTrees: PlazaTree[];
}

/** Town street kinds and widths (m, inferred); a street is painted when a shown house stands within `reach` m. */
export const STREET = { kinds: { residential: 5, service: 3.5, unclassified: 5, living_street: 4 } as Record<string, number>, reach: 15 } as const;
/** Paint (sRGB, inferred: bright Loíza vernacular, research §7). */
const WOOD_PAINT = [0x6f9f98, 0xd6a49a, 0xe4d6b4, 0x7fa06a, 0xc9b25c, 0x9fb8c8];
const CONCRETE_PAINT = [0xe4d6b4, 0xd9c2a8, 0xb8cfc4, 0xe8e2d4, 0xd6a49a];
const HUT_WALL = 0x8a7556;

export function lookOf(u: number, t: TownShares): HouseLook {
  if (u < t.concreteShare.value) return 'concrete';
  if (u >= 1 - t.thatchShare.value) return 'hut';
  return 'wood';
}

const widthOf = (id: string, kind: string) => {
  const story = (Object.keys(STORY_WAYS) as StoryId[]).find((k) => STORY_WAYS[k] === id);
  return story ? STORY_WIDTH[story] : ROAD_WIDTH[kind] ?? STREET.kinds[kind] ?? 4;
};
export function lotRules(bank: number, g: GeoBundle = G): LotRules {
  const [east] = landingPadsFor(bank);
  return {
    centre: TOWN_CENTRE, church: landmarkXZ('church'), clear: padPoint(east, CLEAR_INLAND, 0),
    roads: g.roads.filter((r) => !r.bridge && inTownCircle(r.points)).map((r) => ({ points: r.points, half: widthOf(r.id, r.kind) / 2 + 0.3 }))
      .concat({ points: bridgeWay(g), half: BRIDGE.width / 2 + 3 }),
  };
}
const lots = new Map<number, Lot[]>();
export function lotsFor(bank: number): Lot[] {
  let l = lots.get(bank);
  if (!l) { l = townLots(G, lotRules(bank)); lots.set(bank, l); }
  return l;
}

function house(l: Lot, look: HouseLook): House {
  const pick = (list: number[]) => list[Math.min(list.length - 1, Math.floor(l.p * list.length))];
  return { id: l.id, look, fp: look === 'concrete' ? l.concrete : l.wood,
    paint: look === 'hut' ? HUT_WALL : pick(look === 'wood' ? WOOD_PAINT : CONCRETE_PAINT) };
}
const dirtOf = (f: Footprint, pad: number): DirtPatch => ({ c: f.c, axis: [Math.cos(f.yaw), -Math.sin(f.yaw)], hu: f.hx + pad, hv: f.hz + pad });

function townStreets(g: GeoBundle, houses: House[]): SimpleRoad[] {
  return g.roads
    .filter((r) => Object.hasOwn(STREET.kinds, r.kind) && !r.bridge && inTownCircle(r.points) &&
      houses.some((h) => distToLine(r.points, h.fp.c[0], h.fp.c[1]) <= STREET.reach))
    .map((r) => ({ id: r.id, points: r.points, width: STREET.kinds[r.kind] }));
}

/** Almendros at the corners, palms at the edge middles, inset to 70–75 % of the plaza's half size (inferred, L). */
function plazaTrees(ring: readonly XZ[]): PlazaTree[] {
  const b = orientedBox(ring), out: PlazaTree[] = [];
  const spots: [number, number, PlazaTree['species']][] = [
    [-0.7, -0.7, 'almendro'], [0.7, -0.7, 'almendro'], [0.7, 0.7, 'almendro'], [-0.7, 0.7, 'almendro'],
    [0, -0.75, 'coconut'], [0, 0.75, 'coconut'], [-0.75, 0, 'coconut'], [0.75, 0, 'coconut'],
  ];
  spots.forEach(([sx, sz, species], k) => {
    const c = Math.cos(b.yaw), s = Math.sin(b.yaw), lx = sx * b.hx, lz = sz * b.hz;
    const x = b.c[0] + c * lx + s * lz, z = b.c[1] - s * lx + c * lz;
    if (!inRing(ring, x, z)) return;
    const r = cellRng(k, 0, 4403);
    out.push({ species, x, z, rot: (2 * r() - 1) * (species === 'almendro' ? Math.PI : 0.3), scale: 0.9 + 0.2 * r(), variant: Math.floor(r() * 3) });
  });
  return out;
}

const cache = new Map<string, EraTown>();
export function eraTown(bank: number, era: Era, g: GeoBundle = G): EraTown {
  const key = `${bank}|${era.id}`, hit = g === G ? cache.get(key) : undefined;
  if (hit) return hit;
  const all = g === G ? lotsFor(bank) : townLots(g, lotRules(bank, g)), t = era.town;
  const houses = all.slice(0, Math.round(all.length * t.houseShare.value)).map((l) => house(l, lookOf(l.u, t)));
  const church = churchPlan(g), plaza = plazaRing(g);
  const out: EraTown = {
    houses, streets: townStreets(g, houses), church, plaza, plazaTrees: plazaTrees(plaza),
    dirt: [...houses.map((h) => dirtOf(h.fp, 1.5)), dirtOf(churchReach(church), 2), dirtOf(orientedBox(plaza), 0)],
  };
  if (g === G) cache.set(key, out);
  return out;
}

/** Plants keep out of every shown house (+1 m), the church with its tower (+2 m) and the plaza. */
export function townBlocked(t: EraTown): (x: number, z: number) => boolean {
  const reach = churchReach(t.church);
  const rects: Footprint[] = [...t.houses.map((h) => ({ ...h.fp, hx: h.fp.hx + 1, hz: h.fp.hz + 1 })), { ...reach, hx: reach.hx + 2, hz: reach.hz + 2 }];
  return (x, z) => {
    if (Math.hypot(x - TOWN_CENTRE[0], z - TOWN_CENTRE[1]) > CIRCLE_R + 30) return false;
    if (inRing(t.plaza, x, z)) return true;
    return rects.some((f) => { const [lx, lz] = toLocal(f, x, z); return Math.abs(lx) <= f.hx && Math.abs(lz) <= f.hz; });
  };
}
