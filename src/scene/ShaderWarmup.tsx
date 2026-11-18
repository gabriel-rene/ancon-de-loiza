import { useThree } from '@react-three/fiber';
import { useEffect } from 'react';
import * as THREE from 'three';

/** Gives up waiting after this long, so a driver that never reports "done" cannot hold the load card forever. */
const MAX_WAIT_MS = 15_000;

/**
 * Mount inside <Canvas> after <World>, with the Canvas on frameloop="never": builds every scene shader in parallel
 * (KHR_parallel_shader_compile) and calls onDone, so the first frame does not link ~50 programs one by one.
 */
export function ShaderWarmup({ onDone }: { onDone: () => void }) {
  const gl = useThree((s) => s.gl);
  const scene = useThree((s) => s.scene);
  const camera = useThree((s) => s.camera);
  useEffect(() => {
    let live = true;
    // <Post> draws the scene into a linear render target, which keys a different program than the screen does.
    const rt = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType });
    const prev = gl.getRenderTarget();
    gl.setRenderTarget(rt);
    const compiled = gl.compileAsync(scene, camera);
    gl.setRenderTarget(prev);
    rt.dispose();
    const timeout = new Promise((r) => window.setTimeout(r, MAX_WAIT_MS));
    Promise.race([compiled, timeout]).then(() => { if (live) onDone(); });
    return () => { live = false; };
  }, [gl, scene, camera, onDone]);
  return null;
}
