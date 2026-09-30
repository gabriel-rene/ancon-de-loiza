import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import { advanceClock, defaultCrossingStart } from '../ancon/crossing';
import { vesselSpec } from '../ancon/spec';
import { sharedVesselPose } from '../ancon/vesselPose';
import type { Era } from '../data/eras';
import type { QualitySettings } from '../quality';
import { reflectionHooks } from '../scene/water/reflectionHooks';
import { useStore } from '../state/store';
import { sampleField, type WorldFields } from '../terrain/fields';
import { placementFields } from '../terrain/placementFields';
import { eraTimings } from '../traffic/schedule';
import { FaunaSet } from './FaunaSet';
import { faunaSite } from './site';

/**
 * Phase 5 animals. Driven by the crossing clock: <Ancon> (useFrame priority −1) updates sharedVesselPose.clock
 * before this priority-0 callback runs. With the ferry hidden (?ancon=0) it keeps its own copy of that clock.
 */
export function Fauna({ near, era, q, castShadow }: { near: WorldFields; era: Era; q: QualitySettings; castShadow: boolean }) {
  const bank = era.river.bankOffset.value;
  const place = useMemo(() => placementFields(bank, near), [bank, near]);
  const spec = useMemo(() => vesselSpec(era, eraTimings(era, place)), [era, place]);
  const site = useMemo(() => faunaSite(place, (x, z) => sampleField(near, near.height, x, z)), [place, near]);
  const set = useMemo(() => new FaunaSet({ site, T: spec.timings, moored: spec.moored }, q.fauna, castShadow, q.fauna.reflect), [site, spec, q.fauna, castShadow]);
  useEffect(() => {
    reflectionHooks.before.add(set.beforeReflection); reflectionHooks.after.add(set.afterReflection);
    return () => { reflectionHooks.before.delete(set.beforeReflection); reflectionHooks.after.delete(set.afterReflection); set.dispose(); };
  }, [set]);
  const start = useStore((s) => s.crossingStart), speed = useStore((s) => s.crossingSpeed);
  const frozen = useStore((s) => s.frozen), showAncon = useStore((s) => s.showAncon);
  const own = useRef(start ?? defaultCrossingStart(spec.timings));
  useEffect(() => { own.current = start ?? defaultCrossingStart(spec.timings); }, [start]);
  useFrame((_, dt) => {
    own.current = advanceClock(own.current, Math.min(dt, 0.1), frozen, speed);
    set.update(showAncon ? sharedVesselPose.clock : own.current);
  });
  return <primitive object={set.group} />;
}
