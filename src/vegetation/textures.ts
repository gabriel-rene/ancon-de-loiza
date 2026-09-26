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

/** Fraction of texels whose alpha passes `cut` (alpha in 0..255). */
function coverage(d: Uint8ClampedArray, cut: number, scale = 1) {
  let n = 0;
  for (let i = 3; i < d.length; i += 4) if (d[i] * scale > cut) n++;
  return n / (d.length / 4);
}

/**
 * Box-downsample in premultiplied space; fully transparent texels get `fill` so bilinear/mip
 * filtering at silhouettes bleeds foliage colour instead of black.
 */
function halve(src: ImageData, fill: number[]): ImageData {
  const w = Math.max(1, src.width >> 1), h = Math.max(1, src.height >> 1);
  const out = new ImageData(w, h), s = src.data, d = out.data;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    let r = 0, gg = 0, b = 0, a = 0;
    for (let j = 0; j < 2; j++) for (let i = 0; i < 2; i++) {
      const sx = Math.min(src.width - 1, x * 2 + i), sy = Math.min(src.height - 1, y * 2 + j), k = (sy * src.width + sx) * 4;
      const al = s[k + 3];
      r += s[k] * al; gg += s[k + 1] * al; b += s[k + 2] * al; a += al;
    }
    const o = (y * w + x) * 4;
    if (a > 0) { d[o] = r / a; d[o + 1] = gg / a; d[o + 2] = b / a; } else { d[o] = fill[0]; d[o + 1] = fill[1]; d[o + 2] = fill[2]; }
    d[o + 3] = a / 4;
  }
  return out;
}

/**
 * Canvas → sRGB texture with a coverage-preserving mip chain (alpha of each level rescaled so
 * the fraction of texels passing `alphaTest` matches level 0; Castaño 2010), anisotropy 8.
 */
export function foliageTexture(src: HTMLCanvasElement, alphaTest = 0.5): THREE.Texture {
  const g = src.getContext('2d')!;
  const l0 = g.getImageData(0, 0, src.width, src.height);
  // Average opaque colour, written into transparent texels.
  let r = 0, gg = 0, b = 0, n = 0;
  const d0 = l0.data;
  for (let i = 0; i < d0.length; i += 4) if (d0[i + 3] > 128) { r += d0[i]; gg += d0[i + 1]; b += d0[i + 2]; n++; }
  const fill = n ? [r / n, gg / n, b / n] : [80, 100, 40];
  for (let i = 0; i < d0.length; i += 4) if (d0[i + 3] === 0) { d0[i] = fill[0]; d0[i + 1] = fill[1]; d0[i + 2] = fill[2]; }
  const cut = alphaTest * 255, target = coverage(d0, cut);
  const mips: ImageData[] = [l0];
  let cur = l0;
  while (cur.width > 1 || cur.height > 1) {
    const next = halve(cur, fill);
    // Binary-search an alpha scale that restores the level-0 coverage.
    let lo = 0.5, hi = 4;
    for (let it = 0; it < 12; it++) {
      const mid = (lo + hi) / 2;
      if (coverage(next.data, cut, mid) < target) lo = mid; else hi = mid;
    }
    const s = (lo + hi) / 2, d = next.data;
    for (let i = 3; i < d.length; i += 4) d[i] = Math.min(255, d[i] * s);
    mips.push(next);
    cur = next;
  }
  const tex = new THREE.Texture(l0 as unknown as HTMLImageElement);
  tex.mipmaps = mips;
  tex.generateMipmaps = false;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  tex.needsUpdate = true;
  return tex;
}
