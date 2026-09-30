import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { waterAt } from '../ancon/geometry';
import { advanceClock } from '../ancon/crossing';
import type { CarModel, Era } from '../data/eras';
import geo from '../data/geo/loiza.json';
import type { GeoBundle } from '../data/geo/types';
import { bridgePlan } from '../infrastructure/bridge';
import { bridgeWay } from '../infrastructure/roads';
import { useStore } from '../state/store';
import { sampleField, type WorldFields } from '../terrain/fields';
import { placementFields } from '../terrain/placementFields';
import { BRIDGE_MODELS, BRIDGE_SPEED, bridgeCarAt, bridgeCarCount, bridgeCars, bridgeLanes } from './bridgeTraffic';
import { buildCar, buildWheel, CAR_PARTS, wheelMatrix } from './carKit';
import { trafficMaterials } from './materials';
import { DIMS } from './models';
import { bodyMatrix } from './motion';

const GLASS_ORDER = 2;   // as TrafficSet: the see-through panes draw after the opaque meshes
const G = geo as unknown as GeoBundle, UP = new THREE.Vector3(0, 1, 0);
const _f = new THREE.Vector3(), _r = new THREE.Vector3(), _m = new THREE.Matrix4(), _p = new THREE.Matrix4(), _c = new THREE.Color();

/**
 * Phase 4c, 1986 only: cars cross the open bridge both ways (lo detail, ≥ 150 m from the ferry); about `n` on the
 * bridge at once. ≤ 9 draw calls. Allocation-free per frame. (Named apart from bridgeTraffic.ts: on a
 * case-insensitive disk `./BridgeTraffic` would resolve to that module.)
 */
export function BridgeTrafficMesh({ near, era, n, castShadow }: { near: WorldFields; era: Era; n: number; castShadow: boolean }) {
  const bank = era.river.bankOffset.value, place = useMemo(() => placementFields(bank, near), [bank, near]);
  const groundAt = useMemo(() => (x: number, z: number) => sampleField(near, near.height, x, z), [near]);
  const plan = useMemo(() => bridgePlan(bridgeWay(G), 'open', (x, z) => waterAt(place, x, z), groundAt)!, [place, groundAt]);
  const lanes = useMemo(() => bridgeLanes(G, plan, groundAt), [plan, groundAt]);
  const cars = useMemo(() => bridgeCars(bridgeCarCount(n, lanes, plan)), [n, lanes, plan]);
  const set = useMemo(() => {
    const mats = trafficMaterials(), group = new THREE.Group();
    const parts = {} as Record<CarModel, THREE.InstancedMesh[]>, used = {} as Record<CarModel, number>;
    for (const model of BRIDGE_MODELS) {
      const g = buildCar(model, 'lo'), cap = Math.max(1, cars.filter((c) => c.model === model).length);
      parts[model] = CAR_PARTS.map((p) => new THREE.InstancedMesh(g[p], mats[p], cap)); used[model] = 0;
    }
    const wheel = new THREE.InstancedMesh(buildWheel('lo'), mats.wheel, 4 * cars.length);
    const all = [...BRIDGE_MODELS.flatMap((m) => parts[m]), wheel];
    for (const m of all) { const glass = m.material === mats.glass; if (glass) m.renderOrder = GLASS_ORDER; m.castShadow = castShadow && !glass; m.receiveShadow = true; m.frustumCulled = false; group.add(m); }
    return { group, parts, used, wheel, all };
  }, [cars, castShadow]);
  useEffect(() => () => { for (const m of set.all) { m.dispose(); m.geometry.dispose(); } }, [set]);
  const start = useStore((s) => s.crossingStart), frozen = useStore((s) => s.frozen), speed = useStore((s) => s.crossingSpeed);
  const clock = useRef(start ?? 0);
  useEffect(() => { clock.current = start ?? 0; }, [start]);
  useFrame((_, dt) => {
    clock.current = advanceClock(clock.current, Math.min(dt, 0.1), frozen, speed);
    const { parts, used, wheel } = set;
    for (let i = 0; i < BRIDGE_MODELS.length; i++) used[BRIDGE_MODELS[i]] = 0;
    let wi = 0;
    for (let k = 0; k < cars.length; k++) {
      const car = cars[k];
      if (!bridgeCarAt(lanes[car.lane], car, clock.current, _f, _r)) continue;
      bodyMatrix(_f, _r, UP, _m);
      const meshes = parts[car.model], i = used[car.model]++;
      for (let p = 0; p < meshes.length; p++) meshes[p].setMatrixAt(i, _m);
      meshes[0].setColorAt(i, _c.setHex(car.paint));   // CAR_PARTS[0] is 'paint'
      const d = DIMS[car.model], dist = BRIDGE_SPEED * clock.current;
      for (let w = 0; w < 4; w++) wheel.setMatrixAt(wi++, wheelMatrix(d, w, dist, _m, _p));
    }
    for (let i = 0; i < BRIDGE_MODELS.length; i++) {
      const meshes = parts[BRIDGE_MODELS[i]], u = used[BRIDGE_MODELS[i]];
      for (let p = 0; p < meshes.length; p++) {
        const m = meshes[p];
        m.count = u; m.visible = u > 0; m.instanceMatrix.needsUpdate = true;
        if (m.instanceColor) m.instanceColor.needsUpdate = true;
      }
    }
    wheel.count = wi; wheel.visible = wi > 0; wheel.instanceMatrix.needsUpdate = true;
  });
  return <primitive object={set.group} />;
}
