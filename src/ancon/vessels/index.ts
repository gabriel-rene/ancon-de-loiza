import type { VesselKind } from '../../data/eras';
import type { DeckLayout, VesselSpec } from '../spec';
import type { VesselPart } from './common';
import { buildPlankPlatform } from './plankPlatform';
import { buildSteelPontoon } from './steelPontoon';
import { buildTimberBarge } from './timberBarge';
import { buildWoodPlatform } from './woodPlatform';

export const TRI_BUDGET: Record<VesselKind, number> = { timberBarge: 4000, plankPlatform: 4000, woodPlatform: 7000, steelPontoon: 6000 };
type Builder = (s: VesselSpec, L: DeckLayout, seed: number) => VesselPart[];
const BUILDERS: Record<VesselKind, Builder> = {
  timberBarge: buildTimberBarge, plankPlatform: buildPlankPlatform, woodPlatform: buildWoodPlatform, steelPontoon: buildSteelPontoon,
};
export const buildVessel = (spec: VesselSpec, L: DeckLayout, seed: number): VesselPart[] => BUILDERS[spec.kind](spec, L, seed);
