import {
  addInto, bandpass, brown, envAD, fadeEdges, highpass, loopify, lowpass, mulInto, normalize, rng, samples, tone, white, type Buf,
} from './dsp';

/** Spec 6b §2: every sound in the scene, made in code. Loops are seamless; one-shots fade in and out. */
export type ClipId = 'water' | 'wind' | 'croak' | 'peep' | 'flap' | 'pole' | 'creak' | 'knock' | 'engine' | 'traffic';
export interface ClipDef { loop: boolean; seconds: number; build: (seed: number, sr: number) => Buf }

/** A loop of `sec` s: render sec + fade, then cross-fade the tail into the head. */
const asLoop = (sec: number, fade: number, sr: number, render: (n: number) => Buf) => {
  const n = samples(sec, sr), f = samples(fade, sr);
  return loopify(render(n + f), f);
};

/** River lapping: a soft wash (no sub-bass: speakers play drifting rumble as banging) plus gentle laps every 0.25–0.75 s. */
function water(seed: number, sr: number): Buf {
  const r = rng(seed);
  return normalize(asLoop(4, 0.25, sr, (n) => {
    const bed = normalize(lowpass(bandpass(white(n, r), 350, 0.6, sr), 900, sr), 0.5);
    for (let t = 0.1; t < n / sr - 0.4; t += 0.25 + 0.5 * r()) {
      const len = samples(0.35, sr), lap = bandpass(white(len, r), 350 + 400 * r(), 1.2, sr);
      mulInto(lap, envAD(len, sr, 0, 0.08, 0.12));
      addInto(bed, normalize(lap, 0.25 + 0.2 * r()), samples(t, sr));
    }
    return bed;
  }), 0.7);
}
/** Soft wind with slow gusts, and a little leaf hiss on the gusts. */
function wind(seed: number, sr: number): Buf {
  const r = rng(seed), ph = r() * 6;
  return normalize(asLoop(6, 0.5, sr, (n) => {
    const x = lowpass(bandpass(white(n, r), 450, 0.6, sr), 1200, sr), leaves = highpass(white(n, r), 3000, sr);
    for (let i = 0; i < n; i++) {
      const t = i / sr, g = 0.6 + 0.25 * Math.sin((2 * Math.PI * t) / 3 + ph) + 0.15 * Math.sin((2 * Math.PI * t) / 1.7 + 1);
      x[i] = x[i] * g + leaves[i] * 0.08 * Math.max(0, g - 0.5);
    }
    return x;
  }), 0.5);
}
/** Heron / egret: a rough, low two-part croak. */
function croak(seed: number, sr: number): Buf {
  const r = rng(seed), n = samples(0.6, sr), f0 = 140 + 40 * r();
  const x = tone(n, sr, f0, f0 * 0.72, 'saw'), rasp = white(n, r);
  for (let i = 0; i < n; i++) x[i] *= 0.7 + 0.3 * rasp[i];
  bandpass(x, 900, 0.8, sr);
  const e = envAD(n, sr, 0, 0.01, 0.12), e2 = envAD(n, sr, 0.22 + 0.06 * r(), 0.01, 0.15);
  for (let i = 0; i < n; i++) e[i] += e2[i];
  return fadeEdges(normalize(mulInto(x, e), 0.8), sr);
}
/** Small shore bird: three quick rising peeps. */
function peep(seed: number, sr: number): Buf {
  const r = rng(seed), n = samples(0.35, sr), x = new Float32Array(n), f = 2600 + 500 * r();
  for (const at of [0, 0.11, 0.22]) {
    const len = samples(0.06, sr), c = tone(len, sr, f, f * 1.22, 'sine');
    addInto(x, mulInto(c, envAD(len, sr, 0, 0.005, 0.02)), samples(at + 0.01 * r(), sr));
  }
  return fadeEdges(normalize(x, 0.6), sr);
}
/** Take-off: five wing beats, fading. */
function flap(seed: number, sr: number): Buf {
  const r = rng(seed), n = samples(0.8, sr), x = new Float32Array(n);
  for (let k = 0; k < 5; k++) {
    const len = samples(0.12, sr), b = bandpass(white(len, r), 500 + 150 * r(), 0.9, sr);
    addInto(x, mulInto(b, envAD(len, sr, 0, 0.01, 0.04)), samples(0.02 + k * 0.13, sr), 1 - 0.15 * k);
  }
  return fadeEdges(normalize(x, 0.7), sr);
}
/** Push pole: a wooden thunk on the bed, then a small splash. */
function pole(seed: number, sr: number): Buf {
  const r = rng(seed), n = samples(1.2, sr);
  const x = mulInto(tone(n, sr, 95, 70, 'sine'), envAD(n, sr, 0, 0.003, 0.08));
  addInto(x, mulInto(lowpass(white(n, r), 2000, sr), envAD(n, sr, 0, 0.001, 0.01)), 0, 0.5);
  const splash = mulInto(lowpass(highpass(white(n, r), 1200, sr), 6000, sr), envAD(n, sr, 0.06 + 0.03 * r(), 0.04, 0.25));
  addInto(x, splash, 0, 0.6);
  return fadeEdges(normalize(x, 0.8), sr);
}
/** Rope through the guide: stick-slip pulses (45–75 Hz) through two wooden resonances. */
function creak(seed: number, sr: number): Buf {
  const r = rng(seed), n = samples(0.9, sr), d = n / sr, x = new Float32Array(n);
  for (let t = 0; t < d; ) {
    x[Math.min(n - 1, samples(t, sr))] += 1;
    t += 1 / (50 + 20 * Math.sin((Math.PI * t) / d) + 6 * (r() - 0.5));
  }
  const hi = bandpass(x.slice(), 1400, 6, sr);
  bandpass(x, 600 + 100 * r(), 5, sr);
  addInto(x, hi, 0, 0.5);
  for (let i = 0; i < n; i++) x[i] *= Math.pow(Math.sin((Math.PI * i) / n), 0.7);
  return fadeEdges(normalize(x, 0.7), sr);
}
/** Hull meets landing: a low double knock. */
function knock(seed: number, sr: number): Buf {
  const r = rng(seed), n = samples(0.5, sr), f = 66 + 12 * r();
  const x = mulInto(tone(n, sr, f, f * 0.85, 'sine'), envAD(n, sr, 0, 0.002, 0.12));
  addInto(x, mulInto(tone(n, sr, 2 * f, 2 * f, 'sine'), envAD(n, sr, 0, 0.002, 0.06)), 0, 0.5);
  addInto(x, mulInto(lowpass(white(n, r), 1500, sr), envAD(n, sr, 0, 0.001, 0.015)), 0, 0.6);
  return fadeEdges(normalize(x, 0.9), sr);
}
/** Idling engine far off: 28 Hz harmonics (56 whole cycles per 2 s loop), low-passed, with a slow wobble. */
function engine(seed: number, sr: number): Buf {
  const r = rng(seed), f = 28;
  return normalize(asLoop(2, 0.1, sr, (n) => {
    const wob = normalize(lowpass(lowpass(white(n, r), 8, sr), 8, sr), 1), x = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const t = i / sr;
      let s = 0;
      for (let h = 1; h <= 6; h++) s += Math.sin(2 * Math.PI * h * f * t) / h;
      x[i] = s * (1 + 0.3 * wob[i]);
    }
    lowpass(x, 500, sr);
    return addInto(x, normalize(lowpass(brown(n, r), 120, sr), 0.3), 0);
  }), 0.6);
}
/** Bridge traffic far off: low tyre rumble with a little hiss, swelling slowly. */
function traffic(seed: number, sr: number): Buf {
  const r = rng(seed);
  return normalize(asLoop(4, 0.4, sr, (n) => {
    const x = normalize(lowpass(bandpass(white(n, r), 200, 1.2, sr), 350, sr), 0.6), hiss = highpass(white(n, r), 1500, sr);
    for (let i = 0; i < n; i++) x[i] = (x[i] + hiss[i] * 0.05) * (0.8 + 0.2 * Math.sin((2 * Math.PI * i) / n));
    return x;
  }), 0.5);
}

export const CLIPS: Record<ClipId, ClipDef> = {
  water: { loop: true, seconds: 4, build: water },
  wind: { loop: true, seconds: 6, build: wind },
  croak: { loop: false, seconds: 0.6, build: croak },
  peep: { loop: false, seconds: 0.35, build: peep },
  flap: { loop: false, seconds: 0.8, build: flap },
  pole: { loop: false, seconds: 1.2, build: pole },
  creak: { loop: false, seconds: 0.9, build: creak },
  knock: { loop: false, seconds: 0.5, build: knock },
  engine: { loop: true, seconds: 2, build: engine },
  traffic: { loop: true, seconds: 4, build: traffic },
};
export const CLIP_IDS = Object.keys(CLIPS) as ClipId[];
/** The seed each clip is built with in the app (fixed, so the sound is the same on every visit). */
export const CLIP_SEED = Object.fromEntries(CLIP_IDS.map((id, i) => [id, 101 + i])) as Record<ClipId, number>;
