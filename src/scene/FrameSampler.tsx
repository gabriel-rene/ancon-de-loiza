import { useFrame, useThree } from '@react-three/fiber';
import { useEffect } from 'react';
import type * as THREE from 'three';

declare global {
  interface Window {
    __ANCON_PERF__?: { frames: number[] };
    /** ?debug=1 / ?perf=1: the renderer's live resource counts (renderer.info), for leak probes. */
    __ANCON_GL__?: THREE.WebGLInfo;
  }
}

/** ?perf=1: records frame times (ms) for scripts/dev/perf.mjs. */
export function FrameSampler() {
  const perf = (window.__ANCON_PERF__ ??= { frames: [] });
  useFrame((_, dt) => {
    perf.frames.push(dt * 1000);
    if (perf.frames.length > 6000) perf.frames.splice(0, 1000);
  });
  return null;
}

/** ?debug=1 / ?perf=1: exposes renderer.info as window.__ANCON_GL__ (memory.geometries/textures, programs). */
export function RendererInfo() {
  const gl = useThree((s) => s.gl);
  useEffect(() => {
    window.__ANCON_GL__ = gl.info;
    return () => { delete window.__ANCON_GL__; };
  }, [gl]);
  return null;
}
