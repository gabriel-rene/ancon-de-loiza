import type { RoadSurface } from '../data/eras';
import { cellRng } from '../vegetation/rng';

/*
 * Procedural infrastructure textures (browser only: 2D canvas). Concrete is painted near-white so the
 * per-piece vertex colours carry the paint; zinc, thatch and roads carry their own colour (vertex white).
 * One tile covers TEX_M × TEX_M metres on PartBuilder pieces (worldUv).
 */
function canvas(w: number, h: number) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  return [c, c.getContext('2d')!] as const;
}
const rgba = (r: number, g: number, b: number, a: number) => `rgba(${r | 0},${g | 0},${b | 0},${a.toFixed(3)})`;

export function paintConcrete(): HTMLCanvasElement {
  const S = 512, [c, g] = canvas(S, S), r = cellRng(0, 0, 8101);
  g.fillStyle = '#ebe8e2'; g.fillRect(0, 0, S, S);
  for (let i = 0; i < 40; i++) {   // damp blotches
    const x = r() * S, y = r() * S, rad = 20 + 90 * r(), grd = g.createRadialGradient(x, y, 0, x, y, rad);
    grd.addColorStop(0, rgba(110, 104, 92, 0.05 + 0.08 * r())); grd.addColorStop(1, rgba(110, 104, 92, 0));
    g.fillStyle = grd; g.fillRect(x - rad, y - rad, 2 * rad, 2 * rad);
  }
  for (let y = 0; y < S; y += 64) { g.fillStyle = rgba(90, 86, 78, 0.06); g.fillRect(0, y, S, 2); }   // form-board lines
  for (let i = 0; i < 60; i++) {   // run-off streaks
    const x = r() * S, y = r() * S * 0.5, len = 60 + 200 * r();
    g.fillStyle = rgba(80, 76, 68, 0.03 + 0.05 * r()); g.fillRect(x, y, 2 + 4 * r(), len);
  }
  for (let i = 0; i < 6000; i++) { const v = r() < 0.5 ? 70 : 255; g.fillStyle = rgba(v, v, v, 0.06); g.fillRect(r() * S, r() * S, 1.5, 1.5); }
  return c;
}

export function paintZinc(): HTMLCanvasElement {
  const S = 512, [c, g] = canvas(S, S), r = cellRng(0, 0, 8102);
  for (let x = 0; x < S; x++) {   // corrugation: 16 px period across u
    const k = 0.5 + 0.5 * Math.sin((x / 16) * Math.PI * 2), v = 128 + 55 * k;
    g.fillStyle = rgba(v * 0.93, v * 0.96, v, 1); g.fillRect(x, 0, 1, S);
  }
  for (let i = 0; i < 70; i++) {   // rust
    const x = r() * S, y = r() * S, rad = 8 + 50 * r(), grd = g.createRadialGradient(x, y, 0, x, y, rad);
    grd.addColorStop(0, rgba(122, 64, 30, 0.25 + 0.35 * r())); grd.addColorStop(1, rgba(122, 64, 30, 0));
    g.fillStyle = grd; g.fillRect(x - rad, y - rad, 2 * rad, 2 * rad);
  }
  return c;
}

export function paintThatch(): HTMLCanvasElement {
  const S = 512, [c, g] = canvas(S, S), r = cellRng(0, 0, 8103);
  g.fillStyle = '#6f5a3a'; g.fillRect(0, 0, S, S);
  for (let i = 0; i < 9000; i++) {   // straw strokes, near vertical
    const x = r() * S, y = r() * S, len = 10 + 30 * r(), t = 150 + 70 * r();
    g.strokeStyle = rgba(t, t * 0.82, t * 0.52, 0.25 + 0.35 * r()); g.lineWidth = 1 + r();
    g.beginPath(); g.moveTo(x, y); g.lineTo(x + (r() - 0.5) * 6, y + len); g.stroke();
  }
  for (let y = 0; y < S; y += 48) { g.fillStyle = rgba(40, 30, 18, 0.35); g.fillRect(0, y, S, 5); }   // courses
  return c;
}

/** Road strip tile: 256 px across the road (u), 1024 px = ROAD_V m along it (v). */
export function paintRoad(s: RoadSurface): HTMLCanvasElement {
  const W = 256, H = 1024, [c, g] = canvas(W, H), r = cellRng(0, 0, 8110 + ['sand', 'gravel', 'asphalt'].indexOf(s));
  const base = { sand: '#b39873', gravel: '#8a8276', asphalt: '#3a3a3c' }[s];
  g.fillStyle = base; g.fillRect(0, 0, W, H);
  if (s === 'sand') for (const u of [0.28, 0.72]) {   // cart ruts
    const grd = g.createLinearGradient(u * W - 22, 0, u * W + 22, 0);
    grd.addColorStop(0, rgba(120, 96, 64, 0)); grd.addColorStop(0.5, rgba(110, 86, 56, 0.55)); grd.addColorStop(1, rgba(120, 96, 64, 0));
    g.fillStyle = grd; g.fillRect(u * W - 22, 0, 44, H);
  }
  if (s === 'asphalt') for (const side of [0, 1]) {   // crumbling, dusty edges
    const grd = g.createLinearGradient(side ? W : 0, 0, side ? W - 34 : 34, 0);
    grd.addColorStop(0, rgba(118, 104, 82, 0.9)); grd.addColorStop(1, rgba(118, 104, 82, 0));
    g.fillStyle = grd; g.fillRect(side ? W - 34 : 0, 0, 34, H);
  }
  const n = s === 'gravel' ? 16000 : 7000;
  for (let i = 0; i < n; i++) { const v = r() < 0.5 ? 40 : 230; g.fillStyle = rgba(v, v * 0.97, v * 0.9, s === 'gravel' ? 0.3 : 0.08); g.fillRect(r() * W, r() * H, 2, 2); }
  return c;
}
