import type { VesselKind } from '../../data/eras';
import type { DeckLayout, VesselSpec } from '../spec';
import type { VesselPart } from './common';
import { buildPlankPlatform } from './plankPlatform';
import { buildTimberBarge } from './timberBarge';
import { buildWoodPlatform } from './woodPlatform';

export const TRI_BUDGET: Record<VesselKind, number> = { timberBarge: 4000, plankPlatform: 4000, woodPlatform: 7000, steelPontoon: 6000 };
type Builder = (s: VesselSpec, L: DeckLayout, seed: number) => VesselPart[];
const BUILDERS: Partial<Record<VesselKind, Builder>> = {
  timberBarge: buildTimberBarge, plankPlatform: buildPlankPlatform, woodPlatform: buildWoodPlatform,
};
export function buildVessel(spec: VesselSpec, L: DeckLayout, seed: number): VesselPart[] {
  const b = BUILDERS[spec.kind];
  if (!b) throw new Error(`no builder for ${spec.kind}`);
  return b(spec, L, seed);
}
