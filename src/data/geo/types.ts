export type XZ = [number, number];
export type LandKind = 'sand' | 'wetland' | 'wood' | 'scrub' | 'grassland';
export interface Road { id: string; kind: string; name?: string; ref?: string; bridge: boolean; points: XZ[] }
/** A closed OSM outline (ring without the closing node): a building (`kind` = its building tag) or a park. */
export interface Outline { id: string; kind: string; name?: string; ring: XZ[] }
export interface GeoBundle {
  origin: { lat: number; lon: number };
  water: { kind: 'river' | 'pond'; ring: XZ[] }[];
  land: { kind: LandKind; ring: XZ[] }[];
  coastline: XZ[][];
  roads: Road[];
  /** Phase 4b: outlines whose centre lies within the town circle (bake-osm.ts). */
  buildings: Outline[];
  parks: Outline[];
}
