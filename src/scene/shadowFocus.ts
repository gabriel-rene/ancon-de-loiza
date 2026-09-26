type V3 = [number, number, number];
const dot = (a: V3, b: V3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a: V3, b: V3): V3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const norm = (a: V3): V3 => { const l = Math.hypot(...a); return [a[0] / l, a[1] / l, a[2] / l]; };

/**
 * Where to aim a single directional shadow map so it covers what the camera looks at.
 * Focus = where the view ray meets y=0, clamped to [20, 0.9·half] m ahead (horizontal views
 * use the clamp). The focus is snapped to whole shadow texels in light space so the map
 * does not shimmer as the camera moves.
 */
export function shadowFocus(camPos: V3, camDir: V3, sunDir: V3, half: number, mapSize: number) {
  const maxAhead = 0.9 * half;
  let t = camDir[1] < -1e-3 ? -camPos[1] / camDir[1] : maxAhead;
  t = Math.min(maxAhead, Math.max(20, t));
  const f: V3 = [camPos[0] + camDir[0] * t, 0, camPos[2] + camDir[2] * t];
  const s = norm(sunDir);
  const right = norm(cross([0, 1, 0], s));
  const up = cross(s, right);
  const texel = (2 * half) / mapSize;
  const snap = (v: number) => Math.round(v / texel) * texel;
  const r = snap(dot(f, right)), u = snap(dot(f, up)), w = dot(f, s);
  const target: V3 = [0, 1, 2].map((i) => right[i] * r + up[i] * u + s[i] * w) as V3;
  const position: V3 = [0, 1, 2].map((i) => target[i] + s[i] * 1500) as V3;
  return { target, position };
}
