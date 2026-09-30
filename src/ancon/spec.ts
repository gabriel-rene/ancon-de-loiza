import type { ClothingStyle, Era, Propulsion, VesselKind } from '../data/eras';
import { CROSSING_TIMINGS, type CrossingTimings } from './crossing';

export interface VesselSpec {
  kind: VesselKind; length: number; beam: number; freeboard: number; cars: number; propulsion: Propulsion;
  crew: number; helmsman: boolean; anconera: boolean; shoreRope: boolean; passengers: number; clothing: ClothingStyle;
  moored: boolean;
  /** This era's crossing phase lengths (4c: longer dock stops where the load needs them, src/traffic/schedule.ts). */
  timings: CrossingTimings;
}
export interface DeckLayout {
  halfLength: number; halfBeam: number;
  /** Walking surface height above the waterline (local y). */
  deckY: number;
  /** Hinged end apron/ramp length (0 = none, the barge noses onto the bank). */
  apron: number;
  /** Hull centre → apron tip along local X. */
  reach: number;
  lanes: number; rows: number;
  /** Height of the rope line where it runs over the deck guides (local y). */
  guideY: number;
  /** |z| of the two rope lines (just inside the hull sides). */
  ropeZ: number;
}
/** End apron length per kind (m). Inferred from research §2.2 ("ramp/apron boards at each end", "hinged or loose end ramps"). */
export const APRON: Record<VesselKind, number> = { timberBarge: 0, plankPlatform: 0.9, woodPlatform: 1.1, steelPontoon: 1.6 };
/** Depth of each kind's apron underside below the deck at the hinge (m): plank; planks on beams; steel ramp's hinge knuckles. Checked against the geometry in docking.test. */
export const APRON_UNDER: Record<VesselKind, number> = { timberBarge: 0, plankPlatform: 0.06, woodPlatform: 0.18, steelPontoon: 0.12 };
/** One parked vehicle incl. walking clearance (inferred; compact cars of each era). */
export const CAR_SLOT = { length: 4.4, width: 2.5 } as const;
/** Rope guides/rollers stand this high above the deck. */
export const GUIDE_H = 0.95;

export function vesselSpec(era: Era, timings: CrossingTimings = CROSSING_TIMINGS): VesselSpec {
  const a = era.ancon;
  return {
    kind: a.kind.value, length: a.length.value, beam: a.beam.value, freeboard: a.freeboard.value, cars: a.cars.value,
    propulsion: a.propulsion.value, crew: a.crew.value, helmsman: a.helmsman.value, anconera: a.anconera.value,
    shoreRope: a.shoreRope.value, passengers: a.passengers.value, clothing: a.clothing.value,
    moored: a.propulsion.value === 'moored', timings,
  };
}

export function deckLayout(s: VesselSpec): DeckLayout {
  const lanes = s.cars === 0 ? 0 : s.cars >= 4 ? 2 : 1;
  const rows = lanes === 0 ? 0 : Math.ceil(s.cars / lanes);
  const apron = APRON[s.kind];
  return {
    halfLength: s.length / 2, halfBeam: s.beam / 2, deckY: s.freeboard, apron, reach: s.length / 2 + apron,
    lanes, rows, guideY: s.freeboard + GUIDE_H, ropeZ: s.beam / 2 - 0.25,
  };
}
