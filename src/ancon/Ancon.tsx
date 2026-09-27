import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import type { Era } from '../data/eras';
import type { QualitySettings } from '../quality';
import { useStore } from '../state/store';
import { sampleField, type WorldFields } from '../terrain/fields';
import { placementFields } from '../terrain/placementFields';
import { advanceClock } from './crossing';
import { castActors } from './crew';
import { CrewSet } from './CrewSet';
import { crossingGeometry } from './geometry';
import { vesselMaterials } from './materials';
import { apronLift, computeVesselPose, makePoseContext } from './pose';
import { RopeSet } from './RopeSet';
import { seatAnchors } from './seats';
import { vesselSpec } from './spec';
import { anconTiming } from './stats';
import { emitVesselPose, sharedVesselPose } from './vesselPose';
import { buildVessel } from './vessels';

/**
 * The ferry for the current era. One useFrame drives everything, in order: crossing clock →
 * vessel pose (shared, see useVesselPose) → hull + apron transforms → ropes → crew → [wake: later
 * task] → timing → pose listeners (the ride camera). Nothing else computes the live pose.
 */
export function Ancon({ near, era, q, frozen, castShadow }: {
  near: WorldFields; era: Era; q: QualitySettings; frozen: boolean; castShadow: boolean;
}) {
  const start = useStore((s) => s.crossingStart), speed = useStore((s) => s.crossingSpeed);
  const bank = era.river.bankOffset.value;
  const spec = useMemo(() => vesselSpec(era), [era]);
  // Crossing geometry always comes from the fixed 512 placement fields (never the tier's grid).
  const place = useMemo(() => placementFields(bank, near), [bank, near]);
  const ctx = useMemo(() => makePoseContext(crossingGeometry(place), spec, era.river.flow.value,
    (x: number, z: number) => sampleField(near, near.height, x, z)), [place, spec, era, near]);
  const layout = ctx.layout;
  const parts = useMemo(() => buildVessel(spec, layout, 1), [spec, layout]);
  useEffect(() => () => parts.forEach((p) => p.geometry.dispose()), [parts]);
  // Posts sit on the same 512 placement fields as the crossing; only tessellation follows the tier.
  const ropes = useMemo(() => new RopeSet({ spec, layout, geom: ctx.geom, fields: place, segments: q.ancon.ropeSegments, radial: q.ancon.ropeRadial }),
    [spec, layout, ctx, place, q.ancon.ropeSegments, q.ancon.ropeRadial]);
  useEffect(() => () => ropes.dispose(), [ropes]);
  const seats = useMemo(() => seatAnchors(spec, layout), [spec, layout]);
  const crew = useMemo(() => new CrewSet(castActors(spec, seats, Number(era.id), q.ancon.passengers)), [spec, seats, era.id, q.ancon.passengers]);
  useEffect(() => () => crew.dispose(), [crew]);
  const mats = vesselMaterials();
  const hull = useRef<THREE.Group>(null);
  const aprons = useRef<(THREE.Group | null)[]>([]);
  const clock = useRef(start);
  useEffect(() => { clock.current = start; }, [start]);

  useFrame((state, dt) => {
    const t0 = performance.now();
    clock.current = advanceClock(clock.current, Math.min(dt, 0.1), frozen, speed);
    const pose = computeVesselPose(clock.current, ctx, sharedVesselPose);
    const g = hull.current;
    if (g) { g.matrix.copy(pose.matrix); g.matrixWorldNeedsUpdate = true; }
    for (let i = 0; i < parts.length; i++) {
      const p = parts[i], a = aprons.current[i];
      if (p.apron && a) a.rotation.z = p.apron.end * apronLift(pose.state, p.apron.end);
    }
    const cam = state.camera as THREE.PerspectiveCamera;
    ropes.update(pose, (2 * Math.tan(THREE.MathUtils.degToRad(cam.fov / 2))) / state.size.height);
    crew.update(pose, ctx);
    anconTiming.add(performance.now() - t0);
    emitVesselPose(ctx);
  });

  return (
    <>
    <group ref={hull} matrixAutoUpdate={false}>
      {parts.map((p, i) => p.apron ? (
        <group key={i} ref={(el) => { aprons.current[i] = el; }} position={[p.apron.hinge[0], p.apron.hinge[1], 0]}>
          <mesh geometry={p.geometry} material={mats[p.material]} position={[-p.apron.hinge[0], -p.apron.hinge[1], 0]} castShadow={castShadow} receiveShadow />
        </group>
      ) : (
        <mesh key={i} geometry={p.geometry} material={mats[p.material]} castShadow={castShadow} receiveShadow />
      ))}
    </group>
    {/* Ropes and posts live in world space, outside the hull transform. */}
    <primitive object={ropes.group} />
    {/* Crew and passengers: world space too (deck-local × the vessel pose, computed per figure). */}
    <primitive object={crew.group} />
    </>
  );
}
