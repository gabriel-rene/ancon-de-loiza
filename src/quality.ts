export type Quality = 'high' | 'medium' | 'low';
export interface QualitySettings {
  dpr: [number, number]; nearSize: number; farSize: number; reflScale: number; shadowMap: number; shadowHalf: number; ao: boolean;
  /**
   * lod0: full-mesh radius (m); reflLod0: radius (m) within which the water reflection also
   * draws full meshes (0 = reflection uses cards only); farCards: draw impostor cards beyond
   * lod0; farRing: also place the distant ring (far fields, outside the near extent) as cards.
   */
  veg: { density: number; lod0: number; reflLod0: number; farCards: boolean; farRing: boolean };
  /** Ferry detail: rope tube segments per water span, tube sides, passenger count multiplier. */
  ancon: { ropeSegments: number; ropeRadial: number; passengers: number };
}
export const QUALITY: Record<Quality, QualitySettings> = {
  // DPR capped at 1.75: at 2 the ride view sat on the 60 fps floor (the world alone ran 62–65 fps at 2880×1800).
  high: { dpr: [1, 1.75], nearSize: 512, farSize: 512, reflScale: 0.5, shadowMap: 4096, shadowHalf: 140, ao: true,
    veg: { density: 1, lod0: 220, reflLod0: 50, farCards: true, farRing: true },
    ancon: { ropeSegments: 40, ropeRadial: 6, passengers: 1 } },
  medium: { dpr: [1, 1.5], nearSize: 384, farSize: 256, reflScale: 0.35, shadowMap: 2048, shadowHalf: 110, ao: true,
    veg: { density: 0.7, lod0: 150, reflLod0: 25, farCards: true, farRing: true },
    ancon: { ropeSegments: 32, ropeRadial: 6, passengers: 1 } },
  low: { dpr: [1, 1], nearSize: 256, farSize: 192, reflScale: 0.25, shadowMap: 0, shadowHalf: 0, ao: false,
    // Low keeps cards beyond LOD0 (without them the banks past 90 m were bare while the water
    // still reflected cards) but skips the distant ring (placement cost on slow devices).
    veg: { density: 0.4, lod0: 90, reflLod0: 0, farCards: true, farRing: false },
    ancon: { ropeSegments: 20, ropeRadial: 4, passengers: 0.5 } },
};

export function detectQuality(): Quality {
  if (typeof window === 'undefined') return 'high';
  const coarse = window.matchMedia?.('(pointer: coarse)').matches;
  const cores = navigator.hardwareConcurrency ?? 4;
  const mem = (navigator as Navigator & { deviceMemory?: number }).deviceMemory ?? 8;
  if (coarse && (cores <= 6 || mem <= 4)) return 'low';
  if (coarse || cores <= 4) return 'medium';
  return 'high';
}
