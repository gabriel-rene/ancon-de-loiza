export type Confidence = 'H' | 'M' | 'L';
export interface Sourced<T> { value: T; sources: string[]; confidence: Confidence; inferred?: boolean }
export type EraId = '1840' | '1900' | '1925' | '1935' | '1959' | '1975' | '1984' | '1986';

export type VesselKind = 'timberBarge' | 'plankPlatform' | 'woodPlatform' | 'steelPontoon';
export type Propulsion = 'poles' | 'ropes' | 'moored';
export type ClothingStyle = 'colonial' | 'earlyCentury' | 'midCentury' | 'modern';
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
  /** 1978–86: María Luisa Cortijo, the only woman to run the ancón, is one of the haulers. */
  anconera: Sourced<boolean>;
  /** 1840s Lombera inset: a rope from the craft's side to the shore. */
  shoreRope: Sourced<boolean>;
  /** People standing on deck per trip (Phase 3: people only). */
  passengers: Sourced<number>;
  clothing: Sourced<ClothingStyle>;
}

export interface Era {
  id: EraId;
  label: string;
  years: string;
  /** Representative calendar date (for sun position). */
  date: string;
  summary: Sourced<string>;
  river: {
    /** Metres added to every river bank (pre-dam river was fuller). */
    bankOffset: Sourced<number>;
    /** Surface flow speed, m/s. */
    flow: Sourced<number>;
  };
  vegetation: Record<'redMangrove' | 'coconut' | 'casuarina', Sourced<number>>;
  ancon: AnconEra;
}

const s = <T>(value: T, sources: string[], confidence: Confidence, inferred = false): Sourced<T> =>
  inferred ? { value, sources, confidence, inferred } : { value, sources, confidence };

const PRE_DAM = { bankOffset: s(8, ['S3', 'S15'], 'L', true), flow: s(0.6, ['S3', 'S15'], 'L', true) };
const POST_DAM = { bankOffset: s(0, ['S26'], 'M'), flow: s(0.35, ['S15'], 'L', true) };

// Mangrove fringe is ancient; DRNA Piñones forest confirms red mangrove on lagoon/channel fringes.
const MANGROVE = s(1, ['S22', 'S34'], 'H');
const veg = (coconut: Sourced<number>, casuarina: Sourced<number>) => ({ redMangrove: MANGROVE, coconut, casuarina });
// coconut: coast shifted from sugar to coconut collection (S23); groves mature through the 20th c. (inferred timing).
// casuarina: gives Piñones its name; forest proclaimed 1918 (S22, S28); introduced, mass planting
// early–mid 20th c. (S28, inferred timing). From 1959 onward, modern coastal photos (2026) at the
// old landing show mature Casuarina on the skyline — S19b is "1 Ancón de Loíza.jpg" (the companion
// bank-vegetation photo); S19 ("2 Ancón de Loíza.jpg") is the spit/low-scrub photo and does not show
// casuarina, so it is dropped from these era citations (inferred: true, confidence kept at M).
const VEG = {
  '1840': veg(s(0.35, ['S23'], 'L', true), s(0, ['S28'], 'L', true)),
  '1900': veg(s(0.6, ['S23'], 'M', true), s(0.05, ['S28'], 'L', true)),
  '1925': veg(s(0.9, ['S23'], 'L', true), s(0.55, ['S22', 'S28'], 'L', true)),
  '1935': veg(s(1.0, ['S23'], 'L', true), s(0.8, ['S22', 'S28'], 'L', true)),
  '1959': veg(s(1.0, ['S23'], 'L', true), s(1.0, ['S22', 'S28', 'S19b'], 'M', true)),
  '1975': veg(s(1.0, ['S23'], 'L', true), s(1.0, ['S22', 'S28', 'S19b'], 'M', true)),
  '1984': veg(s(0.95, ['S23'], 'L', true), s(1.0, ['S22', 'S28', 'S19b'], 'M', true)),
  '1986': veg(s(0.95, ['S23'], 'L', true), s(1.0, ['S22', 'S28', 'S19b'], 'M', true)),
} satisfies Record<EraId, ReturnType<typeof veg>>;

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
    crew: s(2, ['S1', 'S4', 'S11'], 'M', true), helmsman: s(false, ['S1'], 'M', true), anconera: s(true, ['S4', 'S11'], 'H'),
    shoreRope: s(false, ['S1'], 'M'), passengers: s(6, ['S4'], 'M', true), clothing: WEAR('modern') },
  '1986': { kind: s<VesselKind>('steelPontoon', ['S4'], 'H'), length: s(20, ['S1', 'S4'], 'M', true), beam: s(7.5, ['S1', 'S4'], 'M', true),
    freeboard: s(0.7, [], 'L', true), cars: s(8, ['S1'], 'H'), propulsion: s<Propulsion>('moored', ['S1', 'S4'], 'H'),
    crew: s(0, ['S1', 'S4'], 'H'), helmsman: s(false, ['S1', 'S4'], 'H'), anconera: s(false, ['S1', 'S4'], 'H'),
    shoreRope: s(false, ['S4'], 'M', true), passengers: s(0, ['S1', 'S4'], 'H'), clothing: WEAR('modern') },
} satisfies Record<EraId, AnconEra>;

export const ERAS: Era[] = [
  { id: '1840', label: 'Colonial crossing', years: '1820s–1890s', date: '1840-03-15',
    summary: s('An official ancón de pasaje, ordered in 1824, carries walkers, carts and animals across a fuller river on the camino real.', ['S3'], 'H'),
    river: PRE_DAM,
    vegetation: VEG['1840'], ancon: ANCON['1840'] },
  { id: '1900', label: 'Sugar era', years: '1900s–1910s', date: '1905-04-09',
    summary: s('The Iturregui sugar family runs the crossing for cane workers. A wooden barge is poled across.', ['S1', 'S3'], 'M'),
    river: PRE_DAM,
    vegetation: VEG['1900'], ancon: ANCON['1900'] },
  { id: '1925', label: 'The Cortijo ancón', years: '1920s', date: '1925-07-26',
    summary: s('Pedro Cortijo buys the ancón in 1920. A plank platform, two mangrove poles, 10 cents a crossing.', ['S1', 'S4'], 'H'),
    river: PRE_DAM,
    vegetation: VEG['1925'], ancon: ANCON['1925'] },
  { id: '1935', label: 'The ropes', years: '1930s–1940s', date: '1935-02-17',
    summary: s('Cars arrive. Two taut marine ropes span the river and two or three men haul the platform by hand.', ['S1', 'S4'], 'H'),
    river: PRE_DAM,
    vegetation: VEG['1935'], ancon: ANCON['1935'] },
  { id: '1959', label: 'Públicos', years: '1950s', date: '1959-08-02',
    summary: s('The platform grows. Shared taxis (públicos) cross. Upstream, the Carraízo dam tames the river.', ['S1', 'S4', 'S15'], 'M'),
    river: POST_DAM,
    vegetation: VEG['1959'], ancon: ANCON['1959'] },
  { id: '1975', label: 'Weekend outings', years: '1960s–1970s', date: '1975-07-27',
    summary: s('Families cross for the day. The Cortijo bar has a terrace over the river. About six cars per trip.', ['S1', 'S4'], 'H'),
    river: POST_DAM,
    vegetation: VEG['1975'], ancon: ANCON['1975'] },
  { id: '1984', label: 'The steel barge', years: '1980–1986', date: '1984-02-17',
    summary: s('A steel-plate barge carries six to eight cars. Next door, the PR-187 bridge rises.', ['S1', 'S4'], 'H'),
    river: POST_DAM,
    vegetation: VEG['1984'], ancon: ANCON['1984'] },
  { id: '1986', label: 'The bridge', years: '1986', date: '1986-02-17',
    summary: s('The Puente de la Restauración opened in 1985. Regular ancón service ends in 1986.', ['S1', 'S4', 'S27'], 'H'),
    river: POST_DAM,
    vegetation: VEG['1986'], ancon: ANCON['1986'] }
];

export const ERA_IDS = ERAS.map((e) => e.id);
export const getEra = (id: EraId) => ERAS.find((e) => e.id === id)!;
