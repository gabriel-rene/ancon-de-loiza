import { useMemo } from 'react';
import * as THREE from 'three';
import geo from '../data/geo/loiza.json';
import type { GeoBundle } from '../data/geo/types';
import { QUALITY } from '../quality';
import { useEra, useStore } from '../state/store';
import { buildFields, type WorldFields } from '../terrain/fields';
import { KeyedCache } from '../vegetation/placementCache';

export const NEAR_EXTENT = 2560;
export const FAR_EXTENT = 10240;

/** Fields depend only on (extent, size, bank offset) — there are only two bank offsets (Phase 1). */
const fieldsCache = new KeyedCache<WorldFields>(6);
const fieldsFor = (extent: number, size: number, bankOffset: number) =>
  fieldsCache.get(`${extent}|${size}|${bankOffset}`, () => buildFields(geo as unknown as GeoBundle, { extent, size, bankOffset }));

export function useWorldFields() {
  const era = useEra();
  const q = QUALITY[useStore((s) => s.quality)];
  const bank = era.river.bankOffset.value;
  return useMemo(() => ({
    near: fieldsFor(NEAR_EXTENT, q.nearSize, bank),
    far: fieldsFor(FAR_EXTENT, q.farSize, bank),
  }), [bank, q.nearSize, q.farSize]);
}

export function makeInfoTexture(data: Uint8Array, size: number) {
  const t = new THREE.DataTexture(data, size, size, THREE.RGBAFormat, THREE.UnsignedByteType);
  t.magFilter = THREE.LinearFilter; t.minFilter = THREE.LinearFilter;
  t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
  t.needsUpdate = true;
  return t;
}
