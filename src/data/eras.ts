export type Confidence = 'H' | 'M' | 'L';
export interface Sourced<T> { value: T; sources: string[]; confidence: Confidence; inferred?: boolean }
export type EraId = '1840' | '1900' | '1925' | '1935' | '1959' | '1975' | '1984' | '1986';

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
}

const s = <T>(value: T, sources: string[], confidence: Confidence, inferred = false): Sourced<T> =>
  inferred ? { value, sources, confidence, inferred } : { value, sources, confidence };

const PRE_DAM = { bankOffset: s(8, ['S3', 'S15'], 'L', true), flow: s(0.6, ['S3', 'S15'], 'L', true) };
const POST_DAM = { bankOffset: s(0, ['S26'], 'M'), flow: s(0.35, ['S15'], 'L', true) };

export const ERAS: Era[] = [
  { id: '1840', label: 'Colonial crossing', years: '1820s–1890s', date: '1840-03-15',
    summary: s('An official ancón de pasaje, ordered in 1824, carries walkers, carts and animals across a fuller river on the camino real.', ['S3'], 'H'),
    river: PRE_DAM },
  { id: '1900', label: 'Sugar era', years: '1900s–1910s', date: '1905-04-09',
    summary: s('The Iturregui sugar family runs the crossing for cane workers. A wooden barge is poled across.', ['S1', 'S3'], 'M'),
    river: PRE_DAM },
  { id: '1925', label: 'The Cortijo ancón', years: '1920s', date: '1925-07-26',
    summary: s('Pedro Cortijo buys the ancón in 1920. A plank platform, two mangrove poles, 10 cents a crossing.', ['S1', 'S4'], 'H'),
    river: PRE_DAM },
  { id: '1935', label: 'The ropes', years: '1930s–1940s', date: '1935-02-17',
    summary: s('Cars arrive. Two taut marine ropes span the river and two or three men haul the platform by hand.', ['S1', 'S4'], 'H'),
    river: PRE_DAM },
  { id: '1959', label: 'Públicos', years: '1950s', date: '1959-08-02',
    summary: s('The platform grows. Shared taxis (públicos) cross. Upstream, the Carraízo dam tames the river.', ['S1', 'S4', 'S15'], 'M'),
    river: POST_DAM },
  { id: '1975', label: 'Weekend outings', years: '1960s–1970s', date: '1975-07-27',
    summary: s('Families cross for the day. The Cortijo bar has a terrace over the river. About six cars per trip.', ['S1', 'S4'], 'H'),
    river: POST_DAM },
  { id: '1984', label: 'The steel barge', years: '1980–1986', date: '1984-02-17',
    summary: s('A steel-plate barge carries six to eight cars. Next door, the PR-187 bridge rises.', ['S1', 'S4'], 'H'),
    river: POST_DAM },
  { id: '1986', label: 'The bridge', years: '1986', date: '1986-02-17',
    summary: s('The Puente de la Restauración opened in 1985. Regular ancón service ends in 1986.', ['S1', 'S4', 'S27'], 'H'),
    river: POST_DAM },
];

export const ERA_IDS = ERAS.map((e) => e.id);
export const getEra = (id: EraId) => ERAS.find((e) => e.id === id)!;
