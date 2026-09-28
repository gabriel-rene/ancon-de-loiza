import { useThree } from '@react-three/fiber';
import { Bloom, EffectComposer, N8AO, Noise, SMAA, ToneMapping, Vignette } from '@react-three/postprocessing';
import { ToneMappingMode } from 'postprocessing';
import { useEffect, useMemo, type ReactElement } from 'react';
import type { Sun } from '../useSun';
import { GradeEffect } from './GradeEffect';
import { HeightFogEffect } from './HeightFogEffect';

export function Post({ sun, ao }: { sun: Sun; ao: boolean }) {
  const camera = useThree((s) => s.camera);
  const fog = useMemo(() => new HeightFogEffect(camera), [camera]);
  const grade = useMemo(() => new GradeEffect(), []);
  useEffect(() => fog.setAtmosphere(sun), [fog, sun]);
  useEffect(() => grade.set(sun.atm.exposure, sun.atm.balance, sun.atm.saturation), [grade, sun]);
  useEffect(() => () => { fog.dispose(); grade.dispose(); }, [fog, grade]);
  return (
    <EffectComposer multisampling={0}>
      {(
        [
          ao ? <N8AO key="ao" aoRadius={3} distanceFalloff={1.5} intensity={2.2} halfRes /> : null,
          <primitive key="fog" object={fog} />,
          // Threshold ~1 (HDR, pre-tonemap): the sun disc, the glow around it and the water
          // glint bloom softly; the lit landscape (well under 1) does not.
          <Bloom key="bloom" mipmapBlur intensity={0.3} luminanceThreshold={1.6} luminanceSmoothing={0.4} radius={0.6} />,
          <primitive key="grade" object={grade} />,
          <ToneMapping key="tonemap" mode={ToneMappingMode.ACES_FILMIC} />,
          <Vignette key="vignette" offset={0.3} darkness={0.5} />,
          // SMAA before grain so the edge detector doesn't chase film noise.
          <SMAA key="smaa" />,
          <Noise key="noise" opacity={0.025} premultiply />,
        ] as (ReactElement | null)[]
      ).filter(Boolean)}
    </EffectComposer>
  );
}
