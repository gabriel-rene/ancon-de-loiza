/** Tiny offline DSP for spec 6b §4.1: plain arrays, no Web Audio, so every clip runs in unit tests. */
export type Buf = Float32Array<ArrayBuffer>;

/** mulberry32: deterministic values in [0, 1). */
export function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export const samples = (sec: number, sr: number) => Math.round(sec * sr);

export function white(n: number, r: () => number): Buf {
  const x = new Float32Array(n);
  for (let i = 0; i < n; i++) x[i] = r() * 2 - 1;
  return x;
}
/** Leaky-integrated white noise: a deep rumble. Not normalized. */
export function brown(n: number, r: () => number): Buf {
  const x = new Float32Array(n);
  let y = 0;
  for (let i = 0; i < n; i++) { y = y * 0.995 + (r() * 2 - 1) * 0.1; x[i] = y; }
  return x;
}
/** A tone whose frequency moves linearly from f0 to f1 Hz over n samples. */
export function tone(n: number, sr: number, f0: number, f1: number, shape: 'sine' | 'saw'): Buf {
  const x = new Float32Array(n);
  let ph = 0;
  for (let i = 0; i < n; i++) {
    const f = f0 + ((f1 - f0) * i) / Math.max(1, n - 1);
    ph += f / sr; ph -= Math.floor(ph);
    x[i] = shape === 'sine' ? Math.sin(2 * Math.PI * ph) : 2 * ph - 1;
  }
  return x;
}
/** One-pole low-pass, in place. */
export function lowpass(x: Buf, hz: number, sr: number): Buf {
  const a = 1 - Math.exp((-2 * Math.PI * hz) / sr);
  let y = 0;
  for (let i = 0; i < x.length; i++) { y += a * (x[i] - y); x[i] = y; }
  return x;
}
/** One-pole high-pass (input minus its low-pass), in place. */
export function highpass(x: Buf, hz: number, sr: number): Buf {
  const a = 1 - Math.exp((-2 * Math.PI * hz) / sr);
  let lp = 0;
  for (let i = 0; i < x.length; i++) { lp += a * (x[i] - lp); x[i] -= lp; }
  return x;
}
/** RBJ band-pass (0 dB peak gain), in place. */
export function bandpass(x: Buf, hz: number, q: number, sr: number): Buf {
  const w = (2 * Math.PI * hz) / sr, al = Math.sin(w) / (2 * q), a0 = 1 + al;
  const b0 = al / a0, b2 = -al / a0, a1 = (-2 * Math.cos(w)) / a0, a2 = (1 - al) / a0;
  let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
  for (let i = 0; i < x.length; i++) {
    const xi = x[i], y = b0 * xi + b2 * x2 - a1 * y1 - a2 * y2;
    x2 = x1; x1 = xi; y2 = y1; y1 = y; x[i] = y;
  }
  return x;
}
/** Envelope: 0 until `start` s, linear rise over `attack` s to 1, then exponential decay with time constant `decay` s. */
export function envAD(n: number, sr: number, start: number, attack: number, decay: number): Buf {
  const e = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const t = i / sr - start;
    e[i] = t < 0 ? 0 : t < attack ? t / attack : Math.exp(-(t - attack) / decay);
  }
  return e;
}
export function mulInto(x: Buf, e: Float32Array): Buf {
  for (let i = 0; i < x.length; i++) x[i] *= e[i];
  return x;
}
/** dst[at + i] += src[i] · gain, clipped to dst's length. */
export function addInto(dst: Buf, src: Float32Array, at: number, gain = 1): Buf {
  for (let i = 0; i < src.length && at + i < dst.length; i++) if (at + i >= 0) dst[at + i] += src[i] * gain;
  return dst;
}
export function normalize(x: Buf, peak: number): Buf {
  let m = 0;
  for (let i = 0; i < x.length; i++) m = Math.max(m, Math.abs(x[i]));
  if (m > 0) for (let i = 0; i < x.length; i++) x[i] *= peak / m;
  return x;
}
/** Short linear fade at both ends of a one-shot (no click at start or stop). */
export function fadeEdges(x: Buf, sr: number, sec = 0.005): Buf {
  const f = Math.min(Math.floor(x.length / 2), samples(sec, sr));
  for (let i = 0; i < f; i++) { const g = i / f; x[i] *= g; x[x.length - 1 - i] *= g; }
  x[0] = 0;
  x[x.length - 1] = 0;
  return x;
}
/**
 * Seamless loop from x (length n + fade): the last `fade` samples are cross-faded (equal power) into the first.
 * Output length n; its sample after the last is x[n], so the join is an original neighbour step of x.
 */
export function loopify(x: Buf, fade: number): Buf {
  const n = x.length - fade, y = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    if (i >= fade) { y[i] = x[i]; continue; }
    const t = i / fade;
    y[i] = x[i] * Math.sqrt(t) + x[n + i] * Math.sqrt(1 - t);
  }
  return y;
}
/** Largest |x[i+1] − x[i]|. */
export function maxStep(x: Float32Array): number {
  let m = 0;
  for (let i = 1; i < x.length; i++) m = Math.max(m, Math.abs(x[i] - x[i - 1]));
  return m;
}
