// src/people/palettes.ts
import * as THREE from 'three';
import type { ClothingStyle } from '../data/eras';
import { cellRng } from '../vegetation/rng';
import type { PartName } from './rig';

export type HatKind = 'none' | 'straw' | 'fedora' | 'cap' | 'wrap';
export type HairKind = 'none' | 'crop' | 'close' | 'bun';
export interface FigureLook {
  female: boolean; dress: boolean; height: number; build: number;
  hat: HatKind; hatColor: number; hair: HairKind; hairColor: number;
  /** Flared trouser hems (1970s) and bare feet select alternate part geometries. */
  flare: boolean; barefoot: boolean;
  colors: Record<PartName, number>;
}
export interface Palette {
  shirts: number[]; trousers: number[]; dresses: number[]; shoes: number[];
  menHats: [HatKind, number][]; womenHats: [HatKind, number][]; hatColors: Partial<Record<HatKind, number[]>>;
  /** Probabilities. */
  shortSleeves: number; barefoot: number; womenDress: number; flare: number;
}
export const SKINS = [0x3a2317, 0x4b2d1e, 0x5d3a27, 0x6e4631, 0x80563b, 0x93674a, 0xa87c5a];
/** Hair: near-black to dark brown, and some grey. */
export const HAIRS = [0x16110d, 0x1d1611, 0x261c15, 0x31241a, 0x6f6a62];
// Whites are sun-faded cotton (≤ 0xdc per channel, so they hold detail at golden hour); mid-century and modern
// shirts and dresses are desaturated ~25 % toward washed cotton.
export const PALETTES: Record<ClothingStyle, Palette> = {
  // 1820s–1890s: undyed/white cotton, straw brims, many barefoot; women in long dresses with head wraps.
  colonial: { shirts: [0xdcd5c4, 0xdcd2bb, 0xcbbfa4], trousers: [0xd9d0bc, 0xbcae92, 0x8e7d63], dresses: [0xdcd3c4, 0xcdb99c, 0xa06d50, 0x6f7f96],
    shoes: [0x3b2a1e], menHats: [['straw', 0.8], ['none', 0.2]], womenHats: [['wrap', 0.85], ['none', 0.15]],
    hatColors: { straw: [0xd6bd86, 0xc9ae74], wrap: [0xdcd5c4, 0xb3402c, 0x2f4b7a, 0xd8a33c] }, shortSleeves: 0, barefoot: 0.7, womenDress: 1, flare: 0 },
  // 1900s–1930s: white/light cotton shirts and trousers, straw brims; long cotton dresses, head wraps.
  earlyCentury: { shirts: [0xdcd6cb, 0xdcd6c8, 0xd0d7dc, 0xcfc4ad], trousers: [0xdcd6c9, 0xc9bda4, 0x5b5a55, 0x8b7b62], dresses: [0xdcd6ca, 0xd9c7a8, 0x9fb3c8, 0xb07a5c],
    shoes: [0x2e2219, 0x4a3526], menHats: [['straw', 0.75], ['none', 0.25]], womenHats: [['wrap', 0.6], ['none', 0.4]],
    hatColors: { straw: [0xdcc48c, 0xcdb27a], wrap: [0xdcd7ce, 0xb3402c, 0x2f4b7a] }, shortSleeves: 0.15, barefoot: 0.3, womenDress: 1, flare: 0 },
  // 1940s–50s: guayaberas, fedoras; knee-length print dresses.
  midCentury: { shirts: [0xdcd9d0, 0xd0d7dc, 0xdcd3b3, 0xdccfc2], trousers: [0x3c3b38, 0x5a5146, 0x2f3542, 0x9a8f7c], dresses: [0xb05a4c, 0x486c84, 0xd6b565, 0x718b63, 0xdcd6ca],
    shoes: [0x241a14, 0x4a3526, 0xd9d2c4], menHats: [['fedora', 0.45], ['straw', 0.2], ['none', 0.35]], womenHats: [['none', 1]],
    hatColors: { fedora: [0x6b5d4c, 0x3d3a36, 0xd8c79f], straw: [0xd6bd86] }, shortSleeves: 0.6, barefoot: 0, womenDress: 0.9, flare: 0 },
  // 1970s–80s: flared jeans, printed shirts, sneakers, baseball caps.
  modern: { shirts: [0xb35d4b, 0xdca45b, 0x578a88, 0x775490, 0xdcd7ca, 0x376550, 0xd7d3cb, 0x253a53], trousers: [0x3d5a80, 0x2f4466, 0x51606e, 0x8a6d4b, 0x2b2b2b],
    dresses: [0xba5461, 0xdcad63, 0x16707f, 0x3a6081, 0xdcdacd], shoes: [0xdcdad5, 0x2b2b2b, 0x8b5e3c],
    menHats: [['cap', 0.4], ['none', 0.6]], womenHats: [['none', 1]], hatColors: { cap: [0xb33a3a, 0x2f4466, 0xdcd5c4, 0x2d6a4f] },
    shortSleeves: 0.85, barefoot: 0.05, womenDress: 0.4, flare: 0.6 },
};

const _c = new THREE.Color(), _hsl = { h: 0, s: 0, l: 0 };

/** A deterministic period outfit for one person; cloth colours get a small per-person hue/value jitter (±4 %). */
export function dressFigure(style: ClothingStyle, seed: number, female: boolean): FigureLook {
  const r = cellRng(seed, 17, 604), P = PALETTES[style];
  const pick = <T>(a: T[]) => a[Math.min(a.length - 1, Math.floor(r() * a.length))];
  const weighted = <K>(a: [K, number][]) => { let x = r(); for (const [k, w] of a) { if ((x -= w) < 0) return k; } return a[a.length - 1][0]; };
  const jit = (hex: number) => {
    _c.setHex(hex).getHSL(_hsl);
    return _c.setHSL((_hsl.h + (r() - 0.5) * 0.02 + 1) % 1, _hsl.s, Math.min(1, _hsl.l * (1 + (r() - 0.5) * 0.08))).getHex();
  };
  const skin = pick(SKINS), dress = female && r() < P.womenDress;
  const top = jit(dress ? pick(P.dresses) : pick(P.shirts)), lower = dress ? top : jit(pick(P.trousers));
  const sleeve = r() < P.shortSleeves ? skin : top, barefoot = r() < P.barefoot, feet = barefoot ? skin : jit(pick(P.shoes));
  const hat = weighted(female ? P.womenHats : P.menHats);
  // Hair shows only bare-headed: under a brim it would read as a band across a faceless head.
  const hairStyle: HairKind = female ? (r() < 0.55 ? 'bun' : 'close') : weighted<HairKind>([['crop', 0.75], ['close', 0.25]]);
  const hair: HairKind = hat === 'none' ? hairStyle : 'none';
  const hairColor = r() < 0.12 ? HAIRS[HAIRS.length - 1] : pick(HAIRS.slice(0, -1));
  return {
    female, dress, hat, hatColor: hat === 'none' ? 0 : jit(pick(P.hatColors[hat] ?? [0xd6bd86])), hair, hairColor,
    flare: !dress && r() < P.flare, barefoot,
    height: female ? 1.52 + 0.18 * r() : 1.62 + 0.2 * r(), build: 0.92 + 0.18 * r(),
    colors: {
      head: skin, torso: top, tail: top, hips: lower, skirt: lower, upperArmL: top, upperArmR: top, foreArmL: sleeve, foreArmR: sleeve, handL: skin, handR: skin,
      thighL: lower, thighR: lower, shinL: dress ? skin : lower, shinR: dress ? skin : lower, footL: feet, footR: feet,
    },
  };
}
