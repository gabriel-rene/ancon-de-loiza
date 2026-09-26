export type Quality = 'high' | 'medium' | 'low';
export interface QualitySettings {
  dpr: [number, number]; nearSize: number; farSize: number; reflScale: number; shadowMap: number; ao: boolean;
}
export const QUALITY: Record<Quality, QualitySettings> = {
  high: { dpr: [1, 2], nearSize: 512, farSize: 512, reflScale: 0.5, shadowMap: 4096, ao: true },
  medium: { dpr: [1, 1.5], nearSize: 384, farSize: 256, reflScale: 0.35, shadowMap: 2048, ao: true },
  low: { dpr: [1, 1], nearSize: 256, farSize: 192, reflScale: 0.25, shadowMap: 0, ao: false },
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
