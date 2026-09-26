function hash(ix: number, iz: number) {
  let h = (Math.imul(ix, 374761393) + Math.imul(iz, 668265263)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967295;
}
export function valueNoise(x: number, z: number) {
  const ix = Math.floor(x), iz = Math.floor(z), fx = x - ix, fz = z - iz;
  const u = fx * fx * (3 - 2 * fx), v = fz * fz * (3 - 2 * fz);
  const a = hash(ix, iz), b = hash(ix + 1, iz), c = hash(ix, iz + 1), d = hash(ix + 1, iz + 1);
  const top = a + (b - a) * u, bot = c + (d - c) * u;
  return top + (bot - top) * v;
}
/** Fractal value noise in [0,1]. */
export function fbm(x: number, z: number, octaves = 4) {
  let s = 0, amp = 0.5, f = 1, n = 0;
  for (let i = 0; i < octaves; i++) { s += amp * valueNoise(x * f, z * f); n += amp; amp *= 0.5; f *= 2.03; }
  return s / n;
}
