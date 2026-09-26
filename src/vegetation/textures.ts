import * as THREE from 'three';
import { cellRng } from './rng';

/*
 * Procedural foliage textures (browser-only: they need a 2D canvas).
 * Painters return the level-0 canvas; `foliageTexture` turns it into a texture whose mip chain
 * preserves alpha-test coverage so thin leaves don't evaporate with distance.
 */

function canvas(w: number, h: number) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return c;
}

const mix = (a: number[], b: number[], t: number) => a.map((v, i) => v + (b[i] - v) * t);
const rgb = (c: number[]) => `rgb(${c.map((v) => Math.round(v)).join(',')})`;
const rgba = (c: number[], a: number) => `rgba(${c.map((v) => Math.round(v)).join(',')},${a})`;

/**
 * Coconut frond, 512×1024, transparent. u across (0 left leaflet tips … 0.5 rachis … 1 right
 * tips), v up the rachis (canvas bottom = frond base, since textures flip Y). ~90 leaflets per
 * side angled 30–40° toward the tip, reaching the ribbon edge (the geometry already scales the
 * span by w(t)); olive → deep green with a paler midrib, yellowing tips, a couple of torn gaps.
 */
export function paintFrond(): HTMLCanvasElement {
  const W = 512, Hh = 1024, cx = W / 2;
  const c = canvas(W, Hh), g = c.getContext('2d')!;
  const rng = cellRng(0, 0, 4242);
  const L = 5; // nominal frond length (m) for converting the leaflet angle into v
  const olive = [122, 134, 52], deep = [58, 88, 30], yellow = [172, 160, 78], rib = [186, 180, 100];
  // Torn gaps: short runs of missing leaflets on one side.
  const gaps = [0, 1].map(() => ({ side: rng() < 0.5 ? -1 : 1, t0: 0.3 + 0.5 * rng(), len: 0.025 + 0.03 * rng() }));
  const N = 90;
  for (const side of [-1, 1]) {
    for (let k = 0; k < N; k++) {
      const t = 0.07 + 0.9 * (k + 0.5 * rng()) / N;
      if (gaps.some((q) => q.side === side && t > q.t0 && t < q.t0 + q.len)) continue;
      const hw = 0.9 * Math.pow(Math.sin(Math.PI * t), 0.6); // metres, matches the geometry
      const reach = (0.82 + 0.17 * rng()) * (cx - 4);          // px in u
      const ang = (30 + 10 * rng()) * Math.PI / 180;
      const dy = (hw * 0.9 * Math.tan(ang)) / L * Hh;          // forward rise in px
      const y0 = (1 - t) * Hh;
      const x1 = cx + side * reach, y1 = y0 - dy;
      // Leaflet thickness in px along v (~5.5 cm real width), widest at ~30% of its length.
      const th = (0.055 / L) * Hh * (0.8 + 0.4 * rng());
      const base = mix(olive, deep, rng());
      const tip = mix(base, yellow, 0.25 + 0.45 * rng());
      const grad = g.createLinearGradient(cx, y0, x1, y1);
      grad.addColorStop(0, rgb(mix(base, deep, 0.35)));
      grad.addColorStop(0.6, rgb(base));
      grad.addColorStop(1, rgb(tip));
      g.fillStyle = grad;
      // Slight curve: leaflets sweep forward a little more toward their tips.
      const mx = cx + side * reach * 0.5, my = y0 - dy * 0.42;
      const nx = 0, ny = 1; // thickness measured along v
      g.beginPath();
      g.moveTo(cx, y0 - th * 0.15 * ny);
      g.quadraticCurveTo(mx + nx, my - th * 0.55, x1, y1);
      g.quadraticCurveTo(mx - nx, my + th * 0.55, cx, y0 + th * 0.15 * ny);
      g.closePath();
      g.fill();
      // Midrib highlight.
      g.strokeStyle = `rgba(${rib.join(',')},0.35)`;
      g.lineWidth = 0.8;
      g.beginPath(); g.moveTo(cx, y0); g.quadraticCurveTo(mx, my, x1, y1); g.stroke();
    }
  }
  // Rachis: thick yellow-green at the base tapering to the tip, drawn over the leaflet roots.
  for (let y = 0; y < Hh; y++) {
    const t = 1 - y / Hh;
    const w = lerp(11, 2, t);
    g.fillStyle = rgb(mix([150, 150, 70], [120, 132, 58], t));
    g.fillRect(cx - w / 2, y, w, 1);
  }
  return c;
}

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/**
 * Red-mangrove leaf card, 512×512 (≈ 1.2 m across), transparent. Rhizophora leaves are opposite
 * and decussate, crowded at the twig ends: ~8 twigs rise from the card bottom/edges, each ending
 * in a rosette of 20–30 thick elliptic leaves (8–13 cm) with a reddish pointed stipule at the
 * tip. Leaves are glossy dark green (#1f3a14-ish) with a paler midrib and a soft highlight
 * stripe; about a tenth show their paler yellow-green undersides and a few are senescent yellow.
 * Every other pair is foreshortened (seen edge-on), as decussate pairs are in projection.
 */
export function paintMangroveLeaves(): HTMLCanvasElement {
  const S = 512, px = S / 1.2; // px per metre
  const c = canvas(S, S), g = c.getContext('2d')!;
  const rng = cellRng(0, 0, 5151);
  const top = [31, 58, 20], deep = [20, 40, 14], under = [98, 114, 56], yellow = [196, 168, 58];
  const leaf = (x: number, y: number, ang: number, len: number, wid: number, kind: number) => {
    g.save();
    g.translate(x, y); g.rotate(ang);
    const pet = len * 0.12;
    g.strokeStyle = 'rgb(70,60,34)'; g.lineWidth = Math.max(1, wid * 0.12);
    g.beginPath(); g.moveTo(0, 0); g.lineTo(pet, 0); g.stroke();
    // Elliptic blade along +x from the petiole, slightly acute tip.
    const L = len - pet, hw = wid / 2;
    const path = () => {
      g.beginPath(); g.moveTo(pet, 0);
      g.bezierCurveTo(pet + L * 0.12, -hw * 1.05, pet + L * 0.72, -hw * 1.1, pet + L, 0);
      g.bezierCurveTo(pet + L * 0.72, hw * 1.1, pet + L * 0.12, hw * 1.05, pet, 0);
      g.closePath();
    };
    const v = 0.85 + 0.3 * rng();
    const base = (kind === 1 ? under : kind === 2 ? yellow : mix(top, deep, rng())).map((q) => q * v);
    path();
    g.fillStyle = rgb(base); g.fill();
    g.save(); path(); g.clip();
    if (kind === 0) {
      // Gloss: a soft pale stripe along one half of the blade (curved leathery surface).
      const off = (rng() < 0.5 ? -1 : 1) * hw * 0.38;
      const grad = g.createLinearGradient(0, off - hw * 0.45, 0, off + hw * 0.45);
      grad.addColorStop(0, 'rgba(150,178,120,0)');
      grad.addColorStop(0.5, `rgba(150,178,120,${0.2 + 0.15 * rng()})`);
      grad.addColorStop(1, 'rgba(150,178,120,0)');
      g.fillStyle = grad;
      g.fillRect(pet + L * 0.1, off - hw * 0.45, L * 0.8, hw * 0.9);
    }
    // Darker rim.
    path(); g.strokeStyle = rgb(base.map((q) => q * 0.6)); g.lineWidth = 1; g.stroke();
    g.restore();
    // Midrib.
    g.strokeStyle = rgb(mix(base, kind === 1 ? [190, 190, 120] : [120, 140, 70], 0.55));
    g.lineWidth = Math.max(0.8, wid * 0.07);
    g.beginPath(); g.moveTo(pet, 0); g.lineTo(pet + L * 0.92, 0); g.stroke();
    g.restore();
  };
  const twigs = 8;
  for (let k = 0; k < twigs; k++) {
    // Twig from the lower half / sides toward a tip inside the card.
    const tx = S * (0.18 + 0.64 * rng()), ty = S * (0.12 + 0.6 * rng());
    const bx = lerp(tx, S * (0.2 + 0.6 * rng()), 0.7), by = Math.min(S - 4, ty + S * (0.3 + 0.25 * rng()));
    const ang = Math.atan2(ty - by, tx - bx);
    g.strokeStyle = 'rgb(84,66,48)'; g.lineWidth = 3.5;
    g.beginPath(); g.moveTo(bx, by); g.quadraticCurveTo((bx + tx) / 2 + (rng() - 0.5) * 30, (by + ty) / 2, tx, ty); g.stroke();
    const pairs = 10 + Math.floor(rng() * 5); // 20–28 leaves
    const span = 0.2 * px; // leaf-bearing twig length
    for (let pI = 0; pI < pairs; pI++) {
      const f = pI / (pairs - 1);                      // 0 = oldest (lowest) pair … 1 = tip
      const d = span * (1 - f);
      const x = tx - Math.cos(ang) * d, y = ty - Math.sin(ang) * d;
      const edgeOn = pI % 2 === 1;
      const len = (0.08 + 0.05 * rng()) * px * lerp(1, 0.55, f * f) * (edgeOn ? 0.85 : 1);
      const wid = len * (0.42 + 0.08 * rng()) * (edgeOn ? 0.55 : 1);
      const spread = lerp(1.25, 0.35, f) + (rng() - 0.5) * 0.3;
      for (const side of [-1, 1]) {
        const r = rng();
        const kind = r < 0.03 ? 2 : r < 0.14 ? 1 : 0;
        leaf(x, y, ang + side * spread + (rng() - 0.5) * 0.25, len, wid, kind);
      }
    }
    // Pointed reddish stipule at the shoot tip.
    g.save(); g.translate(tx, ty); g.rotate(ang);
    g.fillStyle = 'rgb(150,86,60)';
    g.beginPath(); g.moveTo(0, -3); g.lineTo(18, 0); g.lineTo(0, 3); g.closePath(); g.fill();
    g.restore();
  }
  return c;
}

/**
 * Casuarina wisp card, 512×1024 (≈ 1.4 × 2.4 m), transparent; canvas top = the card's top edge
 * at the branch. Casuarina "needles" are thin jointed branchlets hanging in soft tufts: a few
 * grey-brown twigs fan down from the top, and tufts of 18–36 hair-thin strands (1.6–2.8 px,
 * thick enough to survive a few mip levels as streaks) droop from points along them and from a
 * jittered grid over the card body; grey-green between #4d5b3b and #6b7a54, a shade per tuft
 * plus per-strand contrast (so tufts read as separate soft clumps), paler, browner tips.
 * Strand alpha feathers toward the tip (the alpha test trims them to a taper), and tufts thin
 * out toward the card edges so the card outline never reads.
 */
export function paintCasuarinaWisps(): HTMLCanvasElement {
  const W = 512, Hh = 1024, M = 6;
  const c = canvas(W, Hh), g = c.getContext('2d')!;
  const rng = cellRng(0, 0, 6161);
  const dark = [77, 91, 59], light = [107, 122, 84], tipC = [128, 128, 92], twigC = [92, 82, 68];
  g.lineCap = 'round';
  /** 0 at the card's centre line … 1 at its soft elliptical edge. */
  const edge = (x: number, y: number) => Math.hypot((x - W / 2) / (W * 0.5), (y - Hh * 0.46) / (Hh * 0.54));
  const strand = (x0: number, y0: number, ang: number, len: number, shade: number) => {
    // Leaves at `ang` (0 = straight down), bends under its own weight to hang vertically.
    const sx = Math.sin(ang), sy = Math.cos(ang);
    let x1 = x0 + sx * len * 0.55, y1 = y0 + sy * len * 0.55 + len * 0.45;
    const mx = x0 + sx * len * 0.45, my = y0 + sy * len * 0.4;
    // Keep inside the card (shorten rather than clip into a straight edge).
    const k = Math.min(1, x1 < M ? (x0 - M) / Math.max(1, x0 - x1) : x1 > W - M ? (W - M - x0) / Math.max(1, x1 - x0) : 1,
      y1 > Hh - M ? (Hh - M - y0) / Math.max(1, y1 - y0) : 1);
    if (k < 0.25) return;
    x1 = x0 + (x1 - x0) * k; y1 = y0 + (y1 - y0) * k;
    // Per-tuft shade ± per-strand contrast: tufts read as separate soft clumps, strands as streaks.
    const base = mix(dark, light, Math.min(1, Math.max(0, shade + (rng() - 0.5) * 0.7))).map((q) => q * (0.72 + 0.4 * rng()));
    const grad = g.createLinearGradient(x0, y0, x1, y1);
    grad.addColorStop(0, rgba(mix(base, dark, 0.3), 0.95));
    grad.addColorStop(0.6, rgba(base, 0.8));
    grad.addColorStop(1, rgba(mix(base, tipC, 0.5), 0.3));
    g.strokeStyle = grad;
    g.lineWidth = 1.6 + 1.2 * rng();
    g.beginPath(); g.moveTo(x0, y0); g.quadraticCurveTo(mx + (rng() - 0.5) * 6, my, x1, y1); g.stroke();
  };
  const tuft = (x: number, y: number, spread: number, scale: number) => {
    const n = 18 + Math.floor(rng() * 19);
    const lean = (rng() - 0.5) * 0.5, shade = rng();
    for (let i = 0; i < n; i++) {
      const a = lean + (rng() - 0.5) * 2 * spread;
      strand(x + (rng() - 0.5) * 8, y + (rng() - 0.5) * 8, a, (90 + 190 * rng()) * scale, shade);
    }
  };
  // Twigs fanning down and out from the top edge, carrying tufts along their length.
  const twigs = 7 + Math.floor(rng() * 3);
  for (let k = 0; k < twigs; k++) {
    const x0 = W * (0.3 + 0.4 * rng()), y0 = M + 10 * rng();
    const x1 = W * (0.1 + 0.8 * (k + rng()) / twigs), y1 = Hh * (0.4 + 0.3 * rng());
    const mx = lerp(x0, x1, 0.6) + (rng() - 0.5) * 40, my = lerp(y0, y1, 0.35);
    const at = (t: number) => [lerp(lerp(x0, mx, t), lerp(mx, x1, t), t), lerp(lerp(y0, my, t), lerp(my, y1, t), t)];
    g.strokeStyle = rgb(twigC.map((q) => q * (0.85 + 0.3 * rng())));
    g.lineWidth = 2.2;
    g.beginPath(); g.moveTo(x0, y0); g.quadraticCurveTo(mx, my, x1, y1); g.stroke();
    const nT = 5 + Math.floor(rng() * 3);
    for (let i = 0; i < nT; i++) {
      const [x, y] = at((i + 0.2 + 0.6 * rng()) / nT);
      if (rng() > 1.25 - edge(x, y)) continue;               // sparser toward the edges
      tuft(x, y, 0.35 + 0.35 * rng(), lerp(1.1, 0.75, edge(x, y)));
    }
  }
  // Extra tufts on a jittered 5×7 grid filling the body of the card, thinning at its edges.
  for (let j = 0; j < 7; j++) for (let i = 0; i < 5; i++) {
    const x = W * (0.08 + 0.84 * (i + 0.15 + 0.7 * rng()) / 5), y = Hh * (0.02 + 0.7 * (j + rng()) / 7);
    if (rng() < edge(x, y) * edge(x, y)) continue;
    tuft(x, y, 0.3 + 0.35 * rng(), lerp(1, 0.7, edge(x, y)));
  }
  return c;
}

/** Minimal ImageData shape (so the mip maths runs in node tests too). */
export interface Pixels { width: number; height: number; data: Uint8ClampedArray }

/** Fraction of texels whose alpha passes `cut` (alpha in 0..255). */
function coverage(d: Uint8ClampedArray, cut: number, scale = 1) {
  let n = 0;
  for (let i = 3; i < d.length; i += 4) if (d[i] * scale > cut) n++;
  return n / (d.length / 4);
}

/** sRGB byte → linear 0..1 (lookup) and back. */
const SRGB_TO_LIN = new Float32Array(256).map((_, i) => {
  const c = i / 255;
  return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
});
const linToSrgb = (v: number) => 255 * (v <= 0.0031308 ? 12.92 * v : 1.055 * Math.pow(v, 1 / 2.4) - 0.055);

/**
 * Box-downsample in linear light: decode sRGB → linear, premultiply by alpha, average the 2×2
 * block, un-premultiply and re-encode. Fully transparent blocks get `fill` (sRGB bytes) so
 * bilinear/mip filtering at silhouettes bleeds foliage colour instead of black.
 */
export function halve(src: Pixels, fill: number[]): Pixels {
  const w = Math.max(1, src.width >> 1), h = Math.max(1, src.height >> 1);
  const s = src.data, d = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    let r = 0, gg = 0, b = 0, a = 0;
    for (let j = 0; j < 2; j++) for (let i = 0; i < 2; i++) {
      const sx = Math.min(src.width - 1, x * 2 + i), sy = Math.min(src.height - 1, y * 2 + j), k = (sy * src.width + sx) * 4;
      const al = s[k + 3];
      r += SRGB_TO_LIN[s[k]] * al; gg += SRGB_TO_LIN[s[k + 1]] * al; b += SRGB_TO_LIN[s[k + 2]] * al; a += al;
    }
    const o = (y * w + x) * 4;
    if (a > 0) { d[o] = linToSrgb(r / a); d[o + 1] = linToSrgb(gg / a); d[o + 2] = linToSrgb(b / a); } else { d[o] = fill[0]; d[o + 1] = fill[1]; d[o + 2] = fill[2]; }
    d[o + 3] = a / 4;
  }
  return { width: w, height: h, data: d };
}

/**
 * Mean opaque colour (averaged in linear light, returned as sRGB bytes), written into the
 * fully transparent texels of `px` so filtering bleeds foliage colour, not black/white.
 */
export function fillTransparent(px: Pixels): number[] {
  let r = 0, gg = 0, b = 0, n = 0;
  const d = px.data;
  for (let i = 0; i < d.length; i += 4) if (d[i + 3] > 128) { r += SRGB_TO_LIN[d[i]]; gg += SRGB_TO_LIN[d[i + 1]]; b += SRGB_TO_LIN[d[i + 2]]; n++; }
  const fill = n ? [linToSrgb(r / n), linToSrgb(gg / n), linToSrgb(b / n)].map(Math.round) : [80, 100, 40];
  for (let i = 0; i < d.length; i += 4) if (d[i + 3] === 0) { d[i] = fill[0]; d[i + 1] = fill[1]; d[i + 2] = fill[2]; }
  return fill;
}

const SCALE_LO = 0.5, SCALE_HI = 4;

/**
 * Coverage-preserving mip chain (Castaño 2010): each level's alpha is rescaled so the fraction
 * of texels passing `cut` matches level 0. Level 0 is `l0` itself (its transparent texels are
 * assumed already filled). When the alpha-scale search ends pinned at a bound of its range
 * (coverage can't be restored), warns once per chain with `name` and the level (levels
 * smaller than 16 texels excepted).
 */
export function coverageMips(l0: Pixels, fill: number[], cut: number, name: string): Pixels[] {
  const target = coverage(l0.data, cut);
  const mips: Pixels[] = [l0];
  let cur = l0, warned = false;
  for (let level = 1; cur.width > 1 || cur.height > 1; level++) {
    const next = halve(cur, fill);
    let lo = SCALE_LO, hi = SCALE_HI;
    for (let it = 0; it < 12; it++) {
      const mid = (lo + hi) / 2;
      if (coverage(next.data, cut, mid) < target) lo = mid; else hi = mid;
    }
    const s = (lo + hi) / 2, d = next.data;
    const eps = (SCALE_HI - SCALE_LO) / 1024;
    // Levels under 16 texels are skipped: their coverage is quantized in ≥ 1/16 steps (the 1×1
    // level routinely can't match) and they only serve sub-pixel-sized cards.
    if (!warned && next.width * next.height >= 16 && (s - SCALE_LO < eps || SCALE_HI - s < eps)) {
      warned = true;
      console.warn(`foliageTexture "${name}": coverage alpha scale pinned at ${s < 1 ? SCALE_LO : SCALE_HI} on mip level ${level} (${next.width}×${next.height})`);
    }
    for (let i = 3; i < d.length; i += 4) d[i] = Math.min(255, d[i] * s);
    mips.push(next);
    cur = next;
  }
  return mips;
}

/**
 * Canvas → sRGB texture with a coverage-preserving mip chain (alpha of each level rescaled so
 * the fraction of texels passing `alphaTest` matches level 0; Castaño 2010), anisotropy 8.
 * Mips are averaged in linear light. `name` labels the texture (and any coverage warning).
 */
export function foliageTexture(src: HTMLCanvasElement, alphaTest = 0.5, name = 'foliage'): THREE.Texture {
  const g = src.getContext('2d')!;
  const l0 = g.getImageData(0, 0, src.width, src.height);
  const fill = fillTransparent(l0);
  const mips = coverageMips(l0, fill, alphaTest * 255, name)
    .map((m, i) => (i === 0 ? l0 : new ImageData(m.data as Uint8ClampedArray<ArrayBuffer>, m.width, m.height)));
  const tex = new THREE.Texture(l0 as unknown as HTMLImageElement);
  tex.name = name;
  tex.mipmaps = mips;
  tex.generateMipmaps = false;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  tex.needsUpdate = true;
  return tex;
}
