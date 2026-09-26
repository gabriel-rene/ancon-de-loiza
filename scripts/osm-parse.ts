import { XMLParser } from 'fast-xml-parser';
import { ORIGIN, project } from '../src/geo/project.ts';
import type { GeoBundle, LandKind, XZ } from '../src/data/geo/types.ts';

type Tagged = { tag?: { k: string; v: string }[] };
const LAND: Record<string, LandKind> = { sand: 'sand', wetland: 'wetland', wood: 'wood', scrub: 'scrub', grassland: 'grassland' };
const round = (p: XZ): XZ => [Math.round(p[0] * 10) / 10, Math.round(p[1] * 10) / 10];

export function parseOsm(xml: string, keepRoadsWithin: number): GeoBundle {
  const doc = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '', isArray: (n) => ['node', 'way', 'nd', 'tag', 'relation', 'member'].includes(n) }).parse(xml).osm;
  const nodes = new Map<string, XZ>();
  for (const n of doc.node ?? []) nodes.set(n.id, project(Number(n.lat), Number(n.lon)));
  const tags = (e: Tagged) => Object.fromEntries((e.tag ?? []).map((t) => [t.k, t.v]));
  const out: GeoBundle = { origin: { ...ORIGIN }, water: [], land: [], coastline: [], roads: [] };

  for (const w of doc.way ?? []) {
    const t = tags(w);
    const refs: string[] = (w.nd ?? []).map((n: { ref: string }) => n.ref);
    const pts = refs.map((r) => nodes.get(r)).filter((p): p is XZ => !!p).map(round);
    if (pts.length < 2) continue;
    const closed = refs.length > 3 && refs[0] === refs[refs.length - 1];
    const ring = closed ? pts.slice(0, -1) : pts;
    if (t.natural === 'coastline') out.coastline.push(pts);
    else if (t.natural === 'water' && closed && t.water !== 'wastewater') out.water.push({ kind: t.water === 'river' ? 'river' : 'pond', ring });
    else if (LAND[t.natural] && closed) out.land.push({ kind: LAND[t.natural], ring });
    else if (t.highway && pts.some(([x, z]) => Math.abs(x) < keepRoadsWithin && Math.abs(z) < keepRoadsWithin)) {
      out.roads.push({ id: w.id, kind: t.highway, ...(t.name ? { name: t.name } : {}), ...(t.ref ? { ref: t.ref } : {}), bridge: t.bridge === 'yes', points: pts });
    }
  }
  return out;
}
