// src/people/palettes.ts
import type { ClothingStyle } from '../data/eras';
import { cellRng } from '../vegetation/rng';
import type { PartName } from './rig';

export type HatKind = 'none' | 'straw' | 'fedora' | 'cap' | 'wrap';
export interface FigureLook { female: boolean; dress: boolean; height: number; build: number; hat: HatKind; hatColor: number; colors: Record<PartName, number> }
export interface Palette {
  shirts: number[]; trousers: number[]; dresses: number[]; shoes: number[];
  menHats: [HatKind, number][]; womenHats: [HatKind, number][]; hatColors: Partial<Record<HatKind, number[]>>;
  /** Probabilities. */
  shortSleeves: number; barefoot: number; womenDress: number;
}
export const SKINS = [0x3a2317, 0x4b2d1e, 0x5d3a27, 0x6e4631, 0x80563b, 0x93674a, 0xa87c5a];
export const PALETTES: Record<ClothingStyle, Palette> = {
  // 1820s–1890s: undyed/white cotton, straw brims, many barefoot; women in long dresses with head wraps.
  colonial: { shirts: [0xe9e2d0, 0xdcd2bb, 0xcbbfa4], trousers: [0xd9d0bc, 0xbcae92, 0x8e7d63], dresses: [0xe8dfcf, 0xcdb99c, 0xa06d50, 0x6f7f96],
    shoes: [0x3b2a1e], menHats: [['straw', 0.8], ['none', 0.2]], womenHats: [['wrap', 0.85], ['none', 0.15]],
    hatColors: { straw: [0xd6bd86, 0xc9ae74], wrap: [0xe9e2d0, 0xb3402c, 0x2f4b7a, 0xd8a33c] }, shortSleeves: 0, barefoot: 0.7, womenDress: 1 },
  // 1900s–1930s: white/light cotton shirts and trousers, straw brims; long cotton dresses, head wraps.
  earlyCentury: { shirts: [0xefe9dc, 0xe2dccd, 0xd4dbe0, 0xcfc4ad], trousers: [0xe6e0d2, 0xc9bda4, 0x5b5a55, 0x8b7b62], dresses: [0xeee7da, 0xd9c7a8, 0x9fb3c8, 0xb07a5c],
    shoes: [0x2e2219, 0x4a3526], menHats: [['straw', 0.75], ['none', 0.25]], womenHats: [['wrap', 0.6], ['none', 0.4]],
    hatColors: { straw: [0xdcc48c, 0xcdb27a], wrap: [0xf0ebe0, 0xb3402c, 0x2f4b7a] }, shortSleeves: 0.15, barefoot: 0.3, womenDress: 1 },
  // 1940s–50s: guayaberas, fedoras; knee-length print dresses.
  midCentury: { shirts: [0xf1ecdf, 0xd9e3ea, 0xefe2b5, 0xe8d6c4], trousers: [0x3c3b38, 0x5a5146, 0x2f3542, 0x9a8f7c], dresses: [0xc5523f, 0x3f6f8f, 0xe0b54a, 0x6c8f5a, 0xe9e0d0],
    shoes: [0x241a14, 0x4a3526, 0xd9d2c4], menHats: [['fedora', 0.45], ['straw', 0.2], ['none', 0.35]], womenHats: [['none', 1]],
    hatColors: { fedora: [0x6b5d4c, 0x3d3a36, 0xd8c79f], straw: [0xd6bd86] }, shortSleeves: 0.6, barefoot: 0, womenDress: 0.9 },
  // 1970s–80s: flared jeans, printed shirts, sneakers, baseball caps.
  modern: { shirts: [0xc8553d, 0xf2a541, 0x4b8f8c, 0x7d4e9e, 0xe9e2d0, 0x2d6a4f, 0xd8d3c8, 0x1f3b5c], trousers: [0x3d5a80, 0x2f4466, 0x51606e, 0x8a6d4b, 0x2b2b2b],
    dresses: [0xd1495b, 0xedae49, 0x00798c, 0x30638e, 0xf4f1de], shoes: [0xf0eee8, 0x2b2b2b, 0x8b5e3c],
    menHats: [['cap', 0.4], ['none', 0.6]], womenHats: [['none', 1]], hatColors: { cap: [0xb33a3a, 0x2f4466, 0xe9e2d0, 0x2d6a4f] },
    shortSleeves: 0.85, barefoot: 0.05, womenDress: 0.4 },
};

/** A deterministic period outfit for one person. */
export function dressFigure(style: ClothingStyle, seed: number, female: boolean): FigureLook {
  const r = cellRng(seed, 17, 604), P = PALETTES[style];
  const pick = <T>(a: T[]) => a[Math.min(a.length - 1, Math.floor(r() * a.length))];
  const weighted = (a: [HatKind, number][]) => { let x = r(); for (const [k, w] of a) { if ((x -= w) < 0) return k; } return a[a.length - 1][0]; };
  const skin = pick(SKINS), dress = female && r() < P.womenDress;
  const top = dress ? pick(P.dresses) : pick(P.shirts), lower = dress ? top : pick(P.trousers);
  const sleeve = r() < P.shortSleeves ? skin : top, feet = r() < P.barefoot ? skin : pick(P.shoes);
  const hat = weighted(female ? P.womenHats : P.menHats);
  return {
    female, dress, hat, hatColor: hat === 'none' ? 0 : pick(P.hatColors[hat] ?? [0xd6bd86]),
    height: female ? 1.52 + 0.18 * r() : 1.62 + 0.2 * r(), build: 0.92 + 0.18 * r(),
    colors: {
      head: skin, torso: top, hips: lower, skirt: lower, upperArmL: top, upperArmR: top, foreArmL: sleeve, foreArmR: sleeve,
      thighL: lower, thighR: lower, shinL: dress ? skin : lower, shinR: dress ? skin : lower, footL: feet, footR: feet,
    },
  };
}
