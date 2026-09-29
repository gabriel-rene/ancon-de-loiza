import type { Bilingual } from '../i18n/text';
import type { SpeciesId } from '../vegetation/types';

export type Confidence = 'H' | 'M' | 'L';
export interface Sourced<T> { value: T; sources: string[]; confidence: Confidence; inferred?: boolean }
export type EraId = '1840' | '1900' | '1925' | '1935' | '1959' | '1975' | '1984' | '1986';

export type VesselKind = 'timberBarge' | 'plankPlatform' | 'woodPlatform' | 'steelPontoon';
export type Propulsion = 'poles' | 'ropes' | 'moored';
export type ClothingStyle = 'colonial' | 'earlyCentury' | 'midCentury' | 'modern';

/** Era landscape (phase 2c, plants only). All values inferred; see spec 2c §2. */
export interface Landscape {
  /** Share (0..1) of the grassland cane fields shown, lowest rank first. */
  cane: Sourced<number>;
  /** Palm survival (0..1) in the coconut farm blocks; 0 = no farm blocks. */
  plantation: Sourced<number>;
  /** Palm age: 0 young (3–6 m), 0.5 half grown, 1 full grown. Wild and farm palms. */
  palmAge: Sourced<number>;
}

export type RoadSurface = 'sand' | 'gravel' | 'asphalt';
export type LandingLook = 'bank' | 'timber' | 'concrete';
export type StationLook = 'shelter' | 'woodThatch' | 'woodZinc' | 'concrete';
export type BridgeState = 'none' | 'building' | 'open';
export interface Infrastructure {
  roadSurface: Sourced<RoadSurface>; landing: Sourced<LandingLook>; station: Sourced<StationLook>;
  neighbourHouse: Sourced<boolean>; bridge: Sourced<BridgeState>;
}

export interface AnconEra {
  kind: Sourced<VesselKind>;
  /** Hull/deck length without the hinged end aprons, m. */
  length: Sourced<number>;
  beam: Sourced<number>;
  /** Walking surface above the waterline, m. */
  freeboard: Sourced<number>;
  /** Vehicle slots on deck (0 = walkers, carts and animals only). Vehicles themselves arrive in Phase 4. */
  cars: Sourced<number>;
  propulsion: Sourced<Propulsion>;
  /** Polers or rope haulers (the helmsman is counted separately). */
  crew: Sourced<number>;
  /** A second pole "keeps the course" as a rudder (research §2.3). */
  helmsman: Sourced<boolean>;
  /** 1978–86: María Luisa Cortijo, the only woman to run the ancón, hauled it alone after the 1978 anconeros' strike (research §2.4, §9). */
  anconera: Sourced<boolean>;
  /** 1840s Lombera inset: a rope from the craft's side to the shore. */
  shoreRope: Sourced<boolean>;
  /** People standing on deck per trip (Phase 3: people only). */
  passengers: Sourced<number>;
  clothing: Sourced<ClothingStyle>;
}

export interface Era {
  id: EraId;
  label: Bilingual;
  years: Bilingual;
  /** Representative calendar date (for sun position). */
  date: string;
  summary: Sourced<string>;
  river: {
    /** Metres added to every river bank (pre-dam river was fuller). */
    bankOffset: Sourced<number>;
    /** Surface flow speed, m/s. */
    flow: Sourced<number>;
  };
  vegetation: Record<SpeciesId, Sourced<number>>;
  landscape: Landscape;
  infrastructure: Infrastructure;
  ancon: AnconEra;
}

const s = <T>(value: T, sources: string[], confidence: Confidence, inferred = false): Sourced<T> =>
  inferred ? { value, sources, confidence, inferred } : { value, sources, confidence };

const PRE_DAM = { bankOffset: s(8, ['S3', 'S15'], 'L', true), flow: s(0.6, ['S3', 'S15'], 'L', true) };
const POST_DAM = { bankOffset: s(0, ['S26'], 'M'), flow: s(0.35, ['S15'], 'L', true) };

// Mangrove fringe is ancient; DRNA Piñones forest confirms red mangrove on lagoon/channel fringes.
const MANGROVE = s(1, ['S22', 'S34'], 'H');
// Mangrove is ~70 % of the Piñones flora overall, and black and white mangrove are the dominant
// species of its basin mangrove (S22); buttonwood on drier ground; sea grape and beach morning
// glory on the Piñones dunes (research §5).
const BASIN = s(1, ['S22'], 'H');
const BUTTONWOOD = s(1, ['S22'], 'H');
const DUNE = s(1, ['S22'], 'H');
// No site source names the grasses or reeds; open pasture and wet-edge reeds are general
// coastal Puerto Rico (inferred, L).
const GRASS = s(1, [], 'L', true);
// Almendro: families picnicked "under some almond tree" on the bank (S1, 20th c.). The S1 quote
// itself is confirmed; ALMOND's M is for the coverage amount. It is an introduced tree; fewer
// before the 1920s (inferred timing, L).
const ALMOND_EARLY = (v: number) => s(v, ['S1'], 'L', true);
const ALMOND = s(1, ['S1'], 'M');
const veg = (coconut: Sourced<number>, casuarina: Sourced<number>, almendro: Sourced<number>) => ({
  redMangrove: MANGROVE, coconut, casuarina, almendro,
  blackMangrove: BASIN, whiteMangrove: BASIN, buttonwood: BUTTONWOOD, seaGrape: DUNE, morningGlory: DUNE,
  grass: GRASS, reeds: GRASS,
});
// coconut: Loíza's agriculture shifted from sugar to "minor fruits and coconut collection" (S23);
// groves mature through the 20th c. (inferred timing).
// casuarina: gives Piñones its name; forest proclaimed 1918 (S22, S28); introduced, mass planting
// early–mid 20th c. (S28, inferred timing). From 1959 onward, modern coastal photos (2026) at the
// old landing show mature Casuarina on the skyline — S19b is "1 Ancón de Loíza.jpg" (the companion
// bank-vegetation photo); S19 ("2 Ancón de Loíza.jpg") is the spit/low-scrub photo and does not show
// casuarina, so it is dropped from these era citations (inferred: true, confidence kept at M).
const VEG = {
  '1840': veg(s(0.35, ['S23'], 'L', true), s(0, ['S28'], 'L', true), ALMOND_EARLY(0.25)),
  '1900': veg(s(0.6, ['S23'], 'M', true), s(0.05, ['S28'], 'L', true), ALMOND_EARLY(0.4)),
  '1925': veg(s(0.9, ['S23'], 'L', true), s(0.55, ['S22', 'S28'], 'L', true), ALMOND),
  '1935': veg(s(1.0, ['S23'], 'L', true), s(0.8, ['S22', 'S28'], 'L', true), ALMOND),
  '1959': veg(s(1.0, ['S23'], 'L', true), s(1.0, ['S22', 'S28', 'S19b'], 'M', true), ALMOND),
  '1975': veg(s(1.0, ['S23'], 'L', true), s(1.0, ['S22', 'S28', 'S19b'], 'M', true), ALMOND),
  '1984': veg(s(0.95, ['S23'], 'L', true), s(1.0, ['S22', 'S28', 'S19b'], 'M', true), ALMOND),
  '1986': veg(s(0.95, ['S23'], 'L', true), s(1.0, ['S22', 'S28', 'S19b'], 'M', true), ALMOND),
} satisfies Record<EraId, ReturnType<typeof veg>>;

// Cane on the Iturregui estates, whose cane land reached Carolina; the ancón carried their cane
// workers before 1920, when the estates sold the ancón to the Cortijos (S1, research §2.4, §5;
// start date inferred). The coast then shifted from sugar to "minor fruits and coconut collection"
// (S23). Shares, block survival and palm ages are all inferred. 1900's cane confidence stays 'M':
// S1 confirms the Iturregui cane operation was active before 1920, but the 1900 share itself is
// inferred (no source gives a year-by-year figure).
const cane = (v: number, c: Confidence = 'L') => s(v, v > 0 ? ['S1'] : ['S1', 'S23'], c, true);
const farm = (v: number) => s(v, ['S23'], 'L', true);
const age = (v: number) => s(v, ['S23'], 'L', true);
const LAND = {
  '1840': { cane: cane(0.6), plantation: farm(0), palmAge: age(1) },
  '1900': { cane: cane(1, 'M'), plantation: farm(1), palmAge: age(0) },
  '1925': { cane: cane(0.3), plantation: farm(1), palmAge: age(0.5) },
  '1935': { cane: cane(0), plantation: farm(1), palmAge: age(1) },
  '1959': { cane: cane(0), plantation: farm(1), palmAge: age(1) },
  '1975': { cane: cane(0), plantation: farm(0.85), palmAge: age(1) },
  '1984': { cane: cane(0), plantation: farm(0.85), palmAge: age(1) },
  '1986': { cane: cane(0), plantation: farm(0.85), palmAge: age(1) },
} satisfies Record<EraId, Landscape>;

// Clothing: research §7 is general Puerto Rican dress by period, [INFERRED] (L) — no ancón-specific source.
const WEAR = (c: ClothingStyle) => s(c, [], 'L', true);
const NO = (src: string[]) => s(false, src, 'H');
const ANCON = {
  '1840': { kind: s<VesselKind>('timberBarge', ['S3'], 'M'), length: s(8, ['S3'], 'L', true), beam: s(3, ['S3'], 'L', true),
    freeboard: s(0.15, [], 'L', true), cars: s(0, ['S3'], 'L', true), propulsion: s<Propulsion>('poles', ['S3'], 'M'),
    crew: s(2, ['S3'], 'L', true), helmsman: s(true, ['S1'], 'L', true), anconera: NO(['S11']),
    shoreRope: s(true, ['S3'], 'M'), passengers: s(3, ['S3'], 'L', true), clothing: WEAR('colonial') },
  '1900': { kind: s<VesselKind>('timberBarge', ['S3'], 'M'), length: s(8.5, ['S3'], 'L', true), beam: s(3.2, ['S3'], 'L', true),
    freeboard: s(0.15, [], 'L', true), cars: s(0, ['S1'], 'L', true), propulsion: s<Propulsion>('poles', ['S1', 'S3'], 'M'),
    crew: s(2, ['S1'], 'L', true), helmsman: s(true, ['S1'], 'L', true), anconera: NO(['S11']),
    shoreRope: s(false, ['S3'], 'L', true), passengers: s(5, ['S1'], 'L', true), clothing: WEAR('earlyCentury') },
  '1925': { kind: s<VesselKind>('plankPlatform', ['S1', 'S4'], 'H'), length: s(7, ['S4'], 'L', true), beam: s(3.2, ['S4'], 'L', true),
    freeboard: s(0.35, [], 'L', true), cars: s(1, ['S4'], 'H'), propulsion: s<Propulsion>('poles', ['S1', 'S4'], 'H'),
    crew: s(1, ['S1'], 'H'), helmsman: s(true, ['S1'], 'H'), anconera: NO(['S11']),
    shoreRope: s(false, ['S1'], 'M'), passengers: s(3, ['S1'], 'L', true), clothing: WEAR('earlyCentury') },
  '1935': { kind: s<VesselKind>('woodPlatform', ['S1', 'S4'], 'H'), length: s(7.5, ['S4'], 'L', true), beam: s(3.2, ['S4'], 'L', true),
    freeboard: s(0.45, [], 'L', true), cars: s(1, ['S4'], 'H'), propulsion: s<Propulsion>('ropes', ['S1', 'S4'], 'H'),
    crew: s(2, ['S1'], 'H'), helmsman: s(false, ['S1'], 'M', true), anconera: NO(['S11']),
    shoreRope: s(false, ['S1'], 'M'), passengers: s(3, ['S1'], 'L', true), clothing: WEAR('earlyCentury') },
  // spec §13 lists 1 → 2 → 4 → 6 but has three wooden-platform eras; 1959 takes 4 (upper end of the 1950s
  // "2–4 cars incl. público" row), the builder supports 2 as well. (Accepted, preflight F14: research §9
  // gives 1950s "~2–4 cars", so 1935 = 1, 1959 = 4, 1975 = 6.)
  '1959': { kind: s<VesselKind>('woodPlatform', ['S1'], 'H'), length: s(12.5, ['S1'], 'L', true), beam: s(6.2, ['S1'], 'L', true),
    freeboard: s(0.45, [], 'L', true), cars: s(4, ['S1'], 'M', true), propulsion: s<Propulsion>('ropes', ['S1'], 'H'),
    crew: s(3, ['S1'], 'H'), helmsman: s(false, ['S1'], 'M', true), anconera: NO(['S11']),
    shoreRope: s(false, ['S1'], 'M'), passengers: s(4, ['S1', 'S4'], 'L', true), clothing: WEAR('midCentury') },
  '1975': { kind: s<VesselKind>('woodPlatform', ['S1'], 'H'), length: s(17, ['S1'], 'L', true), beam: s(6.6, ['S1'], 'L', true),
    freeboard: s(0.5, [], 'L', true), cars: s(6, ['S1'], 'H'), propulsion: s<Propulsion>('ropes', ['S1'], 'H'),
    crew: s(3, ['S1'], 'H'), helmsman: s(false, ['S1'], 'M', true), anconera: NO(['S11']),
    shoreRope: s(false, ['S1'], 'M'), passengers: s(7, ['S1'], 'M', true), clothing: WEAR('modern') },
  '1984': { kind: s<VesselKind>('steelPontoon', ['S1', 'S4'], 'H'), length: s(20, ['S1', 'S4'], 'M', true), beam: s(7.5, ['S1', 'S4'], 'M', true),
    freeboard: s(0.7, [], 'L', true), cars: s(8, ['S1'], 'H'), propulsion: s<Propulsion>('ropes', ['S1', 'S2', 'S4'], 'H'),
    crew: s(1, ['S4', 'S11'], 'H'), helmsman: s(false, ['S1'], 'M', true), anconera: s(true, ['S4', 'S11'], 'H'),
    shoreRope: s(false, ['S1'], 'M'), passengers: s(6, ['S4'], 'M', true), clothing: WEAR('modern') },
  '1986': { kind: s<VesselKind>('steelPontoon', ['S4'], 'H'), length: s(20, ['S1', 'S4'], 'M', true), beam: s(7.5, ['S1', 'S4'], 'M', true),
    freeboard: s(0.7, [], 'L', true), cars: s(8, ['S1'], 'H'), propulsion: s<Propulsion>('moored', ['S1', 'S4'], 'H'),
    crew: s(0, ['S1', 'S4'], 'H'), helmsman: s(false, ['S1', 'S4'], 'H'), anconera: s(false, ['S1', 'S4'], 'H'),
    shoreRope: s(false, ['S4'], 'M', true), passengers: s(0, ['S1', 'S4'], 'H'), clothing: WEAR('modern') },
} satisfies Record<EraId, AnconEra>;

// Phase 4a (spec 4a §2; sources checked in docs/superpowers/notes/phase-4a-factcheck.md). Sand camino
// real before the 20th c. (research §9, S3); PR-187 numbered 1953 (S30) — gravel in 1935 and asphalt from
// 1959 are inferred. Landing looks are inferred (the landing sits at the end of Calle Carlos Escobar in the
// OSM data). The Cortijos ran the ancón from 1920 (S1); their house was built in the 1960s (S4; concrete is
// inferred), with the bar's river terrace (S4; shown from 1975, inferred). A house beside the landing was
// demolished for the bridge (S4; when is not dated). The reinforced-concrete bridge rose in the early 1980s
// (S4) and was in service by 1986 (S1; S3 gives 1985).
const road = (v: RoadSurface): Sourced<RoadSurface> =>
  v === 'sand' ? s(v, ['S3'], 'M', true) : s(v, ['S30'], 'L', true);
const landing = (v: LandingLook) => s(v, [], 'L', true);
const STATION = {
  shelter: s<StationLook>('shelter', [], 'L', true),
  woodThatch: s<StationLook>('woodThatch', ['S1'], 'L', true),
  woodZinc: s<StationLook>('woodZinc', ['S1', 'S4'], 'L', true),
  concrete: s<StationLook>('concrete', ['S4'], 'M'),
};
const NEIGHBOUR_NONE = s(false, [], 'L', true), NEIGHBOUR = s(true, ['S4'], 'L', true), NEIGHBOUR_GONE = s(false, ['S4'], 'M');
const NO_BRIDGE = s<BridgeState>('none', ['S1'], 'H');
const INFRA = {
  '1840': { roadSurface: road('sand'), landing: landing('bank'), station: STATION.shelter, neighbourHouse: NEIGHBOUR_NONE, bridge: NO_BRIDGE },
  '1900': { roadSurface: road('sand'), landing: landing('bank'), station: STATION.shelter, neighbourHouse: NEIGHBOUR_NONE, bridge: NO_BRIDGE },
  '1925': { roadSurface: road('sand'), landing: landing('bank'), station: STATION.woodThatch, neighbourHouse: NEIGHBOUR_NONE, bridge: NO_BRIDGE },
  '1935': { roadSurface: road('gravel'), landing: landing('timber'), station: STATION.woodZinc, neighbourHouse: NEIGHBOUR, bridge: NO_BRIDGE },
  '1959': { roadSurface: road('asphalt'), landing: landing('timber'), station: STATION.woodZinc, neighbourHouse: NEIGHBOUR, bridge: NO_BRIDGE },
  '1975': { roadSurface: road('asphalt'), landing: landing('concrete'), station: STATION.concrete, neighbourHouse: NEIGHBOUR, bridge: NO_BRIDGE },
  '1984': { roadSurface: road('asphalt'), landing: landing('concrete'), station: STATION.concrete, neighbourHouse: NEIGHBOUR_GONE,
    bridge: s<BridgeState>('building', ['S4'], 'H') },
  '1986': { roadSurface: road('asphalt'), landing: landing('concrete'), station: STATION.concrete, neighbourHouse: NEIGHBOUR_GONE,
    bridge: s<BridgeState>('open', ['S1'], 'H') },
} satisfies Record<EraId, Infrastructure>;

export const ERAS: Era[] = [
  { id: '1840', label: { es: 'Cruce colonial', en: 'Colonial crossing' }, years: { es: 'décadas de 1820–1890', en: '1820s–1890s' }, date: '1840-03-15',
    summary: s('An official ancón de pasaje, ordered in 1824, carries walkers, carts and animals across a fuller river on the camino real.', ['S3'], 'H'),
    river: PRE_DAM,
    vegetation: VEG['1840'], landscape: LAND['1840'], infrastructure: INFRA['1840'], ancon: ANCON['1840'] },
  { id: '1900', label: { es: 'Era del azúcar', en: 'Sugar era' }, years: { es: 'décadas de 1900–1910', en: '1900s–1910s' }, date: '1905-04-09',
    summary: s('The Iturregui sugar family runs the crossing for cane workers. A wooden barge is poled across.', ['S1', 'S3'], 'M'),
    river: PRE_DAM,
    vegetation: VEG['1900'], landscape: LAND['1900'], infrastructure: INFRA['1900'], ancon: ANCON['1900'] },
  { id: '1925', label: { es: 'El ancón de los Cortijo', en: 'The Cortijo ancón' }, years: { es: 'década de 1920', en: '1920s' }, date: '1925-07-26',
    summary: s('Pedro Cortijo buys the ancón in 1920. A plank platform, two mangrove poles, 10 cents a crossing.', ['S1', 'S4'], 'H'),
    river: PRE_DAM,
    vegetation: VEG['1925'], landscape: LAND['1925'], infrastructure: INFRA['1925'], ancon: ANCON['1925'] },
  { id: '1935', label: { es: 'Las sogas', en: 'The ropes' }, years: { es: 'décadas de 1930–1940', en: '1930s–1940s' }, date: '1935-02-17',
    summary: s('Cars arrive. Two taut marine ropes span the river and two or three men haul the platform by hand.', ['S1', 'S4'], 'H'),
    river: PRE_DAM,
    vegetation: VEG['1935'], landscape: LAND['1935'], infrastructure: INFRA['1935'], ancon: ANCON['1935'] },
  { id: '1959', label: { es: 'Públicos', en: 'Públicos' }, years: { es: 'década de 1950', en: '1950s' }, date: '1959-08-02',
    summary: s('The platform grows. Shared taxis (públicos) cross. Upstream, the Carraízo dam tames the river.', ['S1', 'S4', 'S15'], 'M'),
    river: POST_DAM,
    vegetation: VEG['1959'], landscape: LAND['1959'], infrastructure: INFRA['1959'], ancon: ANCON['1959'] },
  { id: '1975', label: { es: 'Paseos de fin de semana', en: 'Weekend outings' }, years: { es: 'décadas de 1960–1970', en: '1960s–1970s' }, date: '1975-07-27',
    summary: s('Families cross for the day. The Cortijo bar has a terrace over the river. About six cars per trip.', ['S1', 'S4'], 'H'),
    river: POST_DAM,
    vegetation: VEG['1975'], landscape: LAND['1975'], infrastructure: INFRA['1975'], ancon: ANCON['1975'] },
  { id: '1984', label: { es: 'La barcaza de acero', en: 'The steel barge' }, years: { es: '1980–1986', en: '1980–1986' }, date: '1984-02-17',
    summary: s('A steel-plate barge carries six to eight cars. Next door, the PR-187 bridge rises.', ['S1', 'S4'], 'H'),
    river: POST_DAM,
    vegetation: VEG['1984'], landscape: LAND['1984'], infrastructure: INFRA['1984'], ancon: ANCON['1984'] },
  { id: '1986', label: { es: 'El puente', en: 'The bridge' }, years: { es: '1986', en: '1986' }, date: '1986-02-17',
    summary: s('The Puente de la Restauración opened in 1985. Regular ancón service ends in 1986.', ['S1', 'S4', 'S27'], 'H'),
    river: POST_DAM,
    vegetation: VEG['1986'], landscape: LAND['1986'], infrastructure: INFRA['1986'], ancon: ANCON['1986'] }
];

export const ERA_IDS = ERAS.map((e) => e.id);
export const getEra = (id: EraId) => ERAS.find((e) => e.id === id)!;
