import type { AnimalLoad, CarModel } from '../data/eras';
import { CAR_SLOT } from '../ancon/spec';

/** Every thing that rides the ferry (spec 4c §3). */
export type MoverKind = CarModel | AnimalLoad | 'bicycle';
/**
 * Sizes (m). Two contact points carry every mover: axles for cars, carts and bicycles (a cart's front contact is
 * its oxen's front hooves, its rear the cart axle), hoof pairs for a horse. `front`: nose ahead of the front contact;
 * `track`: half the distance between left and right wheels (0 on a bicycle). Animals: `front` reaches the
 * drawn muzzle (src/traffic/animals.ts, about 0.93 m ahead of the front hooves). All inferred period types (L), sized
 * for the 4.4 m deck slots.
 */
export interface MoverDims { length: number; width: number; height: number; wheelbase: number; front: number; wheelR: number; track: number }
export const MAX_CAR_LENGTH = CAR_SLOT.length - 0.3;
export const DIMS: Record<MoverKind, MoverDims> = {
  modelT: { length: 3.4, width: 1.68, height: 2.05, wheelbase: 2.54, front: 0.45, wheelR: 0.38, track: 0.72 },
  modelA: { length: 3.85, width: 1.71, height: 1.85, wheelbase: 2.63, front: 0.62, wheelR: 0.36, track: 0.72 },
  sedan50: { length: 4.1, width: 1.8, height: 1.55, wheelbase: 2.6, front: 0.72, wheelR: 0.34, track: 0.74 },
  publico: { length: 4.1, width: 1.8, height: 1.55, wheelbase: 2.6, front: 0.72, wheelR: 0.34, track: 0.74 },
  sedan70: { length: 4.1, width: 1.85, height: 1.38, wheelbase: 2.62, front: 0.78, wheelR: 0.33, track: 0.76 },
  wagon70: { length: 4.1, width: 1.85, height: 1.42, wheelbase: 2.62, front: 0.78, wheelR: 0.33, track: 0.76 },
  tvVan: { length: 4.1, width: 1.9, height: 2.05, wheelbase: 2.5, front: 0.55, wheelR: 0.36, track: 0.78 },
  sedan80: { length: 4.1, width: 1.8, height: 1.36, wheelbase: 2.55, front: 0.8, wheelR: 0.32, track: 0.74 },
  compact80: { length: 3.95, width: 1.63, height: 1.38, wheelbase: 2.37, front: 0.72, wheelR: 0.3, track: 0.68 },
  oxCart: { length: 5.8, width: 1.55, height: 1.6, wheelbase: 3.6, front: 1.0, wheelR: 0.7, track: 0.72 },
  caneCart: { length: 6.0, width: 1.6, height: 2.1, wheelbase: 3.7, front: 1.0, wheelR: 0.72, track: 0.74 },
  horse: { length: 2.65, width: 0.6, height: 1.6, wheelbase: 1.2, front: 1.0, wheelR: 0, track: 0.18 },
  bicycle: { length: 1.75, width: 0.55, height: 1.05, wheelbase: 1.08, front: 0.34, wheelR: 0.34, track: 0 },
};
export const rearOverhang = (d: MoverDims) => d.length - d.front - d.wheelbase;
const CARS = new Set<MoverKind>(['modelT', 'modelA', 'sedan50', 'publico', 'sedan70', 'wagon70', 'tvVan', 'sedan80', 'compact80']);
export const isCar = (k: MoverKind): k is CarModel => CARS.has(k);
export const isAnimal = (k: MoverKind): k is AnimalLoad => k === 'oxCart' || k === 'caneCart' || k === 'horse';
