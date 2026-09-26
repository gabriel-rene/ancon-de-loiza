export type XZ = [number, number];
export type LandKind = 'sand' | 'wetland' | 'wood' | 'scrub' | 'grassland';
export interface Road { id: string; kind: string; name?: string; ref?: string; bridge: boolean; points: XZ[] }
export interface GeoBundle {
  origin: { lat: number; lon: number };
  water: { kind: 'river' | 'pond'; ring: XZ[] }[];
  land: { kind: LandKind; ring: XZ[] }[];
  coastline: XZ[][];
  roads: Road[];
}
