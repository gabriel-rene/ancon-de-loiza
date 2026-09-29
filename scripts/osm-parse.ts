import { XMLParser } from 'fast-xml-parser';
import { ORIGIN, project } from '../src/geo/project.ts';
import type { GeoBundle, LandKind, XZ } from '../src/data/geo/types.ts';

type Tagged = { tag?: { k: string; v: string }[] };
const LAND: Record<string, LandKind> = { sand: 'sand', wetland: 'wetland', wood: 'wood', scrub: 'scrub', grassland: 'grassland' };
const round = (p: XZ): XZ => [Math.round(p[0] * 10) / 10, Math.round(p[1] * 10) / 10];

export interface TownCircle { c: XZ; r: number }

export function parseOsm(xml: string, keepRoadsWithin: number, town?: TownCircle): GeoBundle {
  const doc = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '', isArray: (n) => ['node', 'way', 'nd', 'tag', 'relation', 'member'].includes(n) }).parse(xml).osm;
  const nodes = new Map<string, XZ>();
  for (const n of doc.node ?? []) nodes.set(n.id, project(Number(n.lat), Number(n.lon)));
  const tags = (e: Tagged) => Object.fromEntries((e.tag ?? []).map((t) => [t.k, t.v]));
  const out: GeoBundle = { origin: { ...ORIGIN }, water: [], land: [], coastline: [], roads: [], buildings: [], parks: [] };
  const inTown = (ring: XZ[]) => {
    if (!town) return false;
    const cx = ring.reduce((s, p) => s + p[0], 0) / ring.length, cz = ring.reduce((s, p) => s + p[1], 0) / ring.length;
    return Math.hypot(cx - town.c[0], cz - town.c[1]) <= town.r;
  };
  const wayRings = new Map<string, { ring: XZ[]; closed: boolean }>();

  for (const w of doc.way ?? []) {
    const t = tags(w);
    const refs: string[] = (w.nd ?? []).map((n: { ref: string }) => n.ref);
    const pts = refs.map((r) => nodes.get(r)).filter((p): p is XZ => !!p).map(round);
    if (pts.length < 2) continue;
    const closed = refs.length > 3 && refs[0] === refs[refs.length - 1];
    const ring = closed ? pts.slice(0, -1) : pts;
    wayRings.set(w.id, { ring, closed });
    if (closed && (t.building || t.leisure === 'park')) {
      if (inTown(ring)) (t.building ? out.buildings : out.parks).push({ id: w.id, kind: t.building ?? 'park', ...(t.name ? { name: t.name } : {}), ring });
      continue;
    }
    if (t.natural === 'coastline') out.coastline.push(pts);
    else if (t.natural === 'water' && closed && t.water !== 'wastewater') out.water.push({ kind: t.water === 'river' ? 'river' : 'pond', ring });
    else if (LAND[t.natural] && closed) out.land.push({ kind: LAND[t.natural], ring });
    else if (t.highway && pts.some(([x, z]) => Math.abs(x) < keepRoadsWithin && Math.abs(z) < keepRoadsWithin)) {
      out.roads.push({ id: w.id, kind: t.highway, ...(t.name ? { name: t.name } : {}), ...(t.ref ? { ref: t.ref } : {}), bridge: t.bridge === 'yes', points: pts });
    }
  }

  for (const rel of doc.relation ?? []) {
    const t = tags(rel);
    if (t.type !== 'multipolygon') continue;
    const isWater = t.natural === 'water' && t.water !== 'wastewater';
    const landKind = LAND[t.natural];
    if (!isWater && !landKind) continue;
    const members: { type: string; ref: string; role: string }[] = rel.member ?? [];
    for (const m of members) {
      if (m.type !== 'way' || m.role !== 'outer') continue;
      const w = wayRings.get(m.ref);
      if (!w || !w.closed) continue;
      if (isWater) out.water.push({ kind: t.water === 'river' ? 'river' : 'pond', ring: w.ring });
      else out.land.push({ kind: landKind, ring: w.ring });
    }
  }
  return out;
}
