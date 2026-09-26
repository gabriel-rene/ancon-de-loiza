import { useMemo } from 'react';
import * as THREE from 'three';
import geo from '../data/geo/loiza.json';
import type { GeoBundle } from '../data/geo/types';
import { QUALITY } from '../quality';
import { useEra, useStore } from '../state/store';
import { buildFields } from '../terrain/fields';

export const NEAR_EXTENT = 2560;
export const FAR_EXTENT = 10240;

export function useWorldFields() {
  const era = useEra();
  const q = QUALITY[useStore((s) => s.quality)];
  const bank = era.river.bankOffset.value;
  return useMemo(() => ({
    near: buildFields(geo as unknown as GeoBundle, { extent: NEAR_EXTENT, size: q.nearSize, bankOffset: bank }),
    far: buildFields(geo as unknown as GeoBundle, { extent: FAR_EXTENT, size: q.farSize, bankOffset: bank }),
  }), [bank, q.nearSize, q.farSize]);
}

export function makeInfoTexture(data: Uint8Array, size: number) {
  const t = new THREE.DataTexture(data, size, size, THREE.RGBAFormat, THREE.UnsignedByteType);
  t.magFilter = THREE.LinearFilter; t.minFilter = THREE.LinearFilter;
  t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
  t.needsUpdate = true;
  return t;
}
