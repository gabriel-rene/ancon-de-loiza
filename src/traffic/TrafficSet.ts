import * as THREE from 'three';
import type { CrewSet } from '../ancon/CrewSet';
import type { VesselPose } from '../ancon/pose';
import type { CarModel, LegRule } from '../data/eras';
import { dressFigure, type FigureLook } from '../people/palettes';
import { createFigurePose, poseFigure, segmentMatrix, sitHipHeight, type Body, type FigurePose, type PoseInput, type V3 } from '../people/rig';
import { buildAnimalBody, buildBicycle, buildCart, buildCartWheel, buildLegSegment, legMatrices, OXEN_Z, oxenCentreX } from './animals';
import { buildCar, buildWheel, CAR_PARTS, SILHOUETTES, wheelMatrix, type CarPart } from './carKit';
import type { DockEnv } from './env';
import { trafficMaterials, type TrafficMaterialId } from './materials';
import { DIMS, isCar, type MoverKind } from './models';
import { createMoverFrame, moverFrame, type MoverFrame } from './motion';
import type { LegCache } from './schedule';

/**
 * Legs are two meshes per species: the upper segment is all coat (buildLegSegment(false)), the lower one carries the
 * hoof band (buildLegSegment(true)), so the knee stays clean. Worst era (1925: Model T, ox cart, horse) is 13 draw calls.
 */
export type MeshKey = `${CarModel}:${CarPart}` | 'wheel' | 'oxBody' | 'oxLegUpper' | 'oxLegLower' | 'horseBody' | 'horseLegUpper' | 'horseLegLower'
  | 'cart:oxCart' | 'cart:caneCart' | 'cartWheel' | 'bicycle';

const modelsOf = (rules: readonly LegRule[]) => {
  const s = new Set<MoverKind>();
  for (const r of rules) { r.fixed.forEach((m) => s.add(m)); if (r.cars > r.fixed.length) r.pool.forEach((m) => s.add(m)); if (r.animal) s.add(r.animal); if (r.bicycles) s.add('bicycle'); }
  return s;
};
/** The meshes (= draw calls) an era's load needs. */
export function eraMeshKeys(rules: readonly LegRule[]): MeshKey[] {
  const out: MeshKey[] = [], k = modelsOf(rules);
  let cars = false;
  for (const m of k) if (isCar(m)) { cars = true; for (const p of CAR_PARTS) out.push(`${m}:${p}`); }
  if (cars) out.push('wheel');
  if (k.has('oxCart') || k.has('caneCart')) out.push('oxBody', 'oxLegUpper', 'oxLegLower', 'cartWheel');
  if (k.has('oxCart')) out.push('cart:oxCart');
  if (k.has('caneCart')) out.push('cart:caneCart');
  if (k.has('horse')) out.push('horseBody', 'horseLegUpper', 'horseLegLower');
  if (k.has('bicycle')) out.push('bicycle');
  return out;
}
export const PEOPLE_PER_LEG = (rules: readonly LegRule[]) => Math.max(0, ...rules.map((r) => r.cars + r.bicycles + (r.animal ? 1 : 0)));
/** Figure slots: 3 legs (n − 1, n, n + 1) × the most people any leg carries. Men in period dress (drivers, carters and horse leaders of the time, inferred L). */
export function trafficLooks(env: DockEnv): FigureLook[] {
  const n = 3 * PEOPLE_PER_LEG(env.era.ancon.load.value);
  return Array.from({ length: n }, (_, k) => dressFigure(env.spec.clothing, Number(env.era.id) * 331 + k * 7 + 5, false));
}

const HALF_PI = Math.PI / 2, STRIDE = 1.1;
export const ROOF_CLEAR = 0.06, FEET_HIDE = 0.1;
/** Speed (m/s) at which an animal's gait reaches full amplitude; below it the legs ease toward standing. */
const GAIT_FULL = 0.4;
/** Per car model, its part mesh keys in CAR_PARTS order (no string building per frame). */
const CAR_KEYS = {} as Record<CarModel, MeshKey[]>;
for (const m of ['modelT', 'modelA', 'sedan50', 'publico', 'sedan70', 'wagon70', 'tvVan', 'sedan80', 'compact80'] as const) CAR_KEYS[m] = CAR_PARTS.map((p) => `${m}:${p}` as MeshKey);
const CART_KEY = { oxCart: 'cart:oxCart', caneCart: 'cart:caneCart' } as const;
const OXEN_SIDES = [OXEN_Z, -OXEN_Z] as const;
const _w = new THREE.Matrix4(), _p = new THREE.Matrix4(), _q = new THREE.Matrix4(), _v = new THREE.Vector3(), _v2 = new THREE.Vector3();
const _rot = new THREE.Matrix4().makeRotationY(HALF_PI);   // figure +Z (forward) → model +X
const _legs = Array.from({ length: 8 }, () => new THREE.Matrix4());
const _c = new THREE.Color();
/**
 * Scratch hand targets (figure-local): steering wheel grips (y set per driver); the handlebar grip for a walker on the
 * bicycle's left (right hand, BAR_R) or right (left hand, BAR_L; the side flips with travel, plan.ts); goad ends (world).
 */
const WL: V3 = [0.17, 0, 0.45], WR: V3 = [-0.17, 0, 0.45], BAR_R: V3 = [-0.21, 0.98, 0.14], BAR_L: V3 = [0.21, 0.98, 0.14], GA: V3 = [0, 0, 0], GB: V3 = [0, 0, 0];

/**
 * Feet-plane height (model frame) of a seated driver: hip at the seat (`seatY` + 5 cm), then kept inside the solid
 * cabin — feet no lower than FEET_HIDE under the sill (a high vintage body would show the shins below it), head
 * ROOF_CLEAR under the roof (on the low 1970s–80s roofs the head wins over the feet). `headTop`: posed, figure-local.
 */
export function driverFeetY(kind: CarModel, seatY: number, hip: number, headTop: number): number {
  const s = SILHOUETTES[kind];
  return Math.min(Math.max(seatY - hip + 0.05, s.sill - FEET_HIDE), s.roof - ROOF_CLEAR - headTop);
}

interface Slot { key: MeshKey; mesh: THREE.InstancedMesh; used: number }

/**
 * The ferry load of one era: instanced meshes per model part (created only for the kinds the era uses, eraMeshKeys),
 * written every frame for legs n − 1, n, n + 1 from moverFrame; drivers and attendants go into the crew's figure
 * batch (extra slots). World space, like the crew. Allocation-free per frame.
 */
export class TrafficSet {
  readonly group = new THREE.Group();
  private readonly slots = new Map<MeshKey, Slot>();
  private readonly list: Slot[] = [];
  private readonly frames: MoverFrame[];
  private readonly bodies: Body[];
  private readonly poses: FigurePose[];
  private readonly inputs: PoseInput[];
  private readonly perLeg: number;
  private readonly geos: THREE.BufferGeometry[] = [];

  constructor(private readonly env: DockEnv, private readonly cache: LegCache, private readonly crew: CrewSet, castShadow: boolean) {
    const rules = env.era.ancon.load.value, kinds = modelsOf(rules);
    this.perLeg = PEOPLE_PER_LEG(rules);
    const maxOf = (k: MoverKind) => Math.max(0, ...rules.map((r) => (r.animal === k ? 1 : k === 'bicycle' ? r.bicycles : isCar(k) ? r.fixed.filter((m) => m === k).length + (r.pool.includes(k as CarModel) ? r.cars - r.fixed.length : 0) : 0)));
    const add = (key: MeshKey, geo: THREE.BufferGeometry, mat: TrafficMaterialId, cap: number) => {
      if (cap <= 0) return;
      const mesh = new THREE.InstancedMesh(geo, trafficMaterials()[mat], cap);
      mesh.castShadow = castShadow; mesh.receiveShadow = true; mesh.frustumCulled = false; mesh.count = 0; mesh.visible = false;
      const slot = { key, mesh, used: 0 };
      this.slots.set(key, slot); this.list.push(slot); this.group.add(mesh); this.geos.push(geo);
    };
    let carCap = 0;
    for (const k of kinds) if (isCar(k)) {
      const g = buildCar(k, 'hi'), cap = 3 * maxOf(k); carCap += cap;
      for (const p of CAR_PARTS) add(`${k}:${p}`, g[p], p, cap);
    }
    add('wheel', buildWheel('hi'), 'wheel', 4 * carCap);
    const carts = (kinds.has('oxCart') ? 3 : 0) + (kinds.has('caneCart') ? 3 : 0);
    if (carts) {
      add('oxBody', buildAnimalBody('ox'), 'hide', 2 * carts);
      add('oxLegUpper', buildLegSegment(false), 'hide', 8 * carts); add('oxLegLower', buildLegSegment(true), 'hide', 8 * carts);
      add('cartWheel', buildCartWheel(), 'wood', 2 * carts);
    }
    if (kinds.has('oxCart')) add('cart:oxCart', buildCart('oxCart'), 'wood', 3);
    if (kinds.has('caneCart')) add('cart:caneCart', buildCart('caneCart'), 'wood', 3);
    if (kinds.has('horse')) {
      add('horseBody', buildAnimalBody('horse'), 'hide', 3);
      add('horseLegUpper', buildLegSegment(false), 'hide', 12); add('horseLegLower', buildLegSegment(true), 'hide', 12);
    }
    if (kinds.has('bicycle')) add('bicycle', buildBicycle(), 'bike', 3 * maxOf('bicycle'));
    const looks = trafficLooks(env);
    this.frames = Array.from({ length: 3 * Math.max(1, this.perLeg) }, createMoverFrame);
    this.bodies = looks.map((l) => ({ height: l.height, build: l.build, dress: l.dress }));
    this.poses = looks.map(createFigurePose);
    this.inputs = looks.map((): PoseInput => ({ kind: 'stand', phase: 0, t: 0, seed: 0 }));
  }

  private put(key: MeshKey, m: THREE.Matrix4, color?: number) {
    const slot = this.slots.get(key)!;
    slot.mesh.setMatrixAt(slot.used, m);
    if (color !== undefined) slot.mesh.setColorAt(slot.used, _c.setHex(color));
    slot.used++;
  }

  /** Four legs: uppers (legMatrices out[0..3]) and lowers (out[4..7]) into their own meshes, tinted with the coat. */
  private legs(upper: MeshKey, lower: MeshKey, tint: number) {
    for (let i = 0; i < 4; i++) { this.put(upper, _legs[i], tint); this.put(lower, _legs[i + 4], tint); }
  }

  update(pose: VesselPose) {
    for (let i = 0; i < this.list.length; i++) this.list[i].used = 0;
    const n = pose.state.legIndex, clock = pose.clock;
    let fi = 0;
    for (let dl = -1; dl <= 1; dl++) {
      const leg = n + dl, movers = this.cache.get(leg).movers, slot0 = (((leg % 3) + 3) % 3) * this.perLeg;
      let person = 0;
      for (let j = 0; j < movers.length; j++) {
        const s = movers[j], fr = moverFrame(s, this.env, clock, pose, this.frames[fi++]), m = s.m, d = m.dims;
        for (let q = 0; q < m.people.length; q++) {
          const k = slot0 + person++, p = m.people[q];
          if (!fr.visible) { this.crew.hideExtra(k); continue; }
          this.person(k, fr, p.role, p.at, p.goad, m.kind);
        }
        if (!fr.visible) continue;
        const gait = Math.min(1, Math.max(0, fr.speed / GAIT_FULL));
        if (isCar(m.kind)) {
          const keys = CAR_KEYS[m.kind];
          for (let i = 0; i < keys.length; i++) this.put(keys[i], fr.matrix, i === 0 ? m.paint : undefined);   // CAR_PARTS[0] is 'paint'
          for (let w = 0; w < 4; w++) this.put('wheel', wheelMatrix(d, w, fr.dist, fr.matrix, _p));
        } else if (m.kind === 'oxCart' || m.kind === 'caneCart') {
          this.put(CART_KEY[m.kind], fr.matrix);
          for (let o = 0; o < 2; o++) {
            _w.makeTranslation(oxenCentreX(m.kind), 0, OXEN_SIDES[o]); _p.multiplyMatrices(fr.matrix, _w);
            this.put('oxBody', _p, m.paint);
            legMatrices('ox', fr.dist, gait, _p, _legs);
            this.legs('oxLegUpper', 'oxLegLower', m.paint);
          }
          const spin = fr.dist / d.wheelR;
          for (let o = 0; o < 2; o++) {
            _w.makeRotationZ(-spin).premultiply(_q.makeScale(d.wheelR, d.wheelR, 1)).setPosition(-d.wheelbase / 2, d.wheelR, o === 0 ? d.track : -d.track);
            this.put('cartWheel', _p.multiplyMatrices(fr.matrix, _w));
          }
        } else if (m.kind === 'horse') {
          this.put('horseBody', fr.matrix, m.paint);
          legMatrices('horse', fr.dist, gait, fr.matrix, _legs);
          this.legs('horseLegUpper', 'horseLegLower', m.paint);
        } else if (m.kind === 'bicycle') this.put('bicycle', fr.matrix, m.paint);
      }
      for (let k = slot0 + person; k < slot0 + this.perLeg; k++) this.crew.hideExtra(k);
    }
    for (let i = 0; i < this.list.length; i++) {
      const mesh = this.list[i].mesh, used = this.list[i].used;
      mesh.count = used; mesh.visible = used > 0; mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    }
  }

  /** A driver (seated in the model at `at`) or an attendant on foot (standing at `at`, facing forward). */
  private person(k: number, fr: MoverFrame, role: 'driver' | 'attendant', at: [number, number, number], goad: boolean, kind: MoverKind) {
    const body = this.bodies[k], fp = this.poses[k], input = this.inputs[k];
    input.t = fr.dist; input.seed = k; input.handL = undefined; input.handR = undefined;
    if (role === 'driver') {
      const hip = sitHipHeight(body);
      WL[1] = WR[1] = hip + 0.36;
      input.kind = 'sit'; input.phase = 0; input.handL = WL; input.handR = WR;
      poseFigure(body, input, fp);
      _w.makeTranslation(at[0], isCar(kind) ? driverFeetY(kind, at[1], hip, fp.headTop) : at[1] - hip + 0.05, at[2]).multiply(_rot);
    } else {
      input.kind = fr.speed > 0.05 ? 'walk' : 'stand'; input.phase = (fr.dist / STRIDE) % 1;
      if (kind === 'bicycle') { if (at[2] > 0) input.handL = BAR_L; else input.handR = BAR_R; }   // the hand on the bicycle's side
      poseFigure(body, input, fp);
      _w.makeTranslation(at[0], 0, at[2]).multiply(_rot);
    }
    _p.multiplyMatrices(fr.matrix, _w);
    let pole: THREE.Matrix4 | undefined;
    if (goad && role === 'attendant') {
      // Goad: from the right hand back toward the oxen's heads (a long thin stick).
      _v.set(fp.handR[0], fp.handR[1], fp.handR[2]).applyMatrix4(_p);
      _v2.set(DIMS[kind].wheelbase / 2 + 0.1, 1.3, 0).applyMatrix4(fr.matrix);
      GA[0] = _v.x; GA[1] = _v.y; GA[2] = _v.z; GB[0] = _v2.x; GB[1] = _v2.y; GB[2] = _v2.z;
      pole = segmentMatrix(GA, GB, 0.6, 0.6, _q);
    }
    this.crew.setExtra(k, _p, fp, pole);
  }

  dispose() {
    for (const s of this.list) { s.mesh.dispose(); this.group.remove(s.mesh); }
    for (const g of this.geos) g.dispose();
  }
}
