import { useMemo } from 'react';
import * as THREE from 'three';
import { atmosphereFor } from '../geo/atmosphere';
import { sunAt, sunDirection } from '../geo/sun';
import { useEra, useStore } from '../state/store';

export function useSun() {
  const era = useEra();
  const t = useStore((s) => s.timeOfDay);
  return useMemo(() => {
    const s = sunAt(era.date, t);
    return { dir: new THREE.Vector3(...sunDirection(s.azimuth, s.elevation)), elevation: s.elevation, atm: atmosphereFor(s.elevation) };
  }, [era.date, t]);
}
export type Sun = ReturnType<typeof useSun>;
