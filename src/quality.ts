export type Quality = 'high' | 'medium' | 'low';
export interface QualitySettings {
  dpr: [number, number]; nearSize: number; farSize: number; reflScale: number; shadowMap: number; shadowHalf: number; ao: boolean;
  /**
   * lod0: full-mesh radius (m); reflLod0: radius (m) within which the water reflection also
   * draws full meshes (0 = reflection uses cards only).
   */
  veg: { density: number; lod0: number; reflLod0: number; farCards: boolean };
}
export const QUALITY: Record<Quality, QualitySettings> = {
  high: { dpr: [1, 2], nearSize: 512, farSize: 512, reflScale: 0.5, shadowMap: 4096, shadowHalf: 140, ao: true,
    veg: { density: 1, lod0: 220, reflLod0: 50, farCards: true } },
  medium: { dpr: [1, 1.5], nearSize: 384, farSize: 256, reflScale: 0.35, shadowMap: 2048, shadowHalf: 110, ao: true,
    veg: { density: 0.7, lod0: 150, reflLod0: 25, farCards: true } },
  low: { dpr: [1, 1], nearSize: 256, farSize: 192, reflScale: 0.25, shadowMap: 0, shadowHalf: 0, ao: false,
    veg: { density: 0.4, lod0: 90, reflLod0: 0, farCards: false } },
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
