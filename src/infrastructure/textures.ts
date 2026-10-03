import signSvg from '../../docs/assets/el-ancon-de-loiza-sign.svg?raw';
import type { RoadSurface } from '../data/eras';
import { cellRng } from '../vegetation/rng';
import { ATLAS, REGIONS, type SignRegion } from './signAtlas';

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

/** One run of sign-painter lettering: text, colour, CSS font (size set by `letter`). */
interface Run { text: string; color: string; font?: string; gap?: number }
const BLOCK = '900 100px "Arial Black", "Helvetica Neue", Arial, sans-serif';
/**
 * Paint `runs` on one line inside region `r`: letters `letter` × the region height tall, squeezed
 * sideways (never stretched) to fit 92 % of its width, like hand-lettering fitted to a wall.
 */
function letter(g: CanvasRenderingContext2D, r: SignRegion, runs: Run[], size: number, base = 0.72, outline?: string) {
  const [x, y, w, h] = REGIONS[r], px = size * h;
  const fontOf = (u: Run) => (u.font ?? BLOCK).replace('100px', `${px.toFixed(0)}px`);
  const widths = runs.map((u) => { g.font = fontOf(u); return g.measureText(u.text).width; });
  const total = widths.reduce((a, b, i) => a + b + (i ? (runs[i].gap ?? 0.35) * px : 0), 0), k = Math.min(1, (0.92 * w) / total);
  g.save(); g.translate(x + (w - total * k) / 2, y + base * h); g.scale(k, 1);
  let cx = 0;
  runs.forEach((u, i) => {
    if (i) cx += (u.gap ?? 0.35) * px;
    g.font = fontOf(u);
    if (outline) { g.strokeStyle = outline; g.lineWidth = px * 0.08; g.lineJoin = 'round'; g.strokeText(u.text, cx, 0); }
    g.fillStyle = u.color; g.fillText(u.text, cx, 0);
    cx += widths[i];
  });
  g.restore();
}
/** Sun, rain and salt over a region: faded patches, run-off streaks, flecks of bare ground. */
function weather(g: CanvasRenderingContext2D, r: SignRegion, seed: number, amount = 1) {
  const [x, y, w, h] = REGIONS[r], rng = cellRng(0, seed, 8120);
  g.save(); g.beginPath(); g.rect(x, y, w, h); g.clip();
  for (let i = 0; i < 30 * amount; i++) {
    const cx = x + rng() * w, cy = y + rng() * h, rad = 20 + 80 * rng(), grd = g.createRadialGradient(cx, cy, 0, cx, cy, rad);
    grd.addColorStop(0, rgba(240, 236, 226, 0.08 + 0.1 * rng())); grd.addColorStop(1, rgba(240, 236, 226, 0));
    g.fillStyle = grd; g.fillRect(cx - rad, cy - rad, 2 * rad, 2 * rad);
  }
  for (let i = 0; i < 50 * amount; i++) { g.fillStyle = rgba(70, 60, 48, 0.04 + 0.06 * rng()); g.fillRect(x + rng() * w, y + rng() * h * 0.4, 2 + 3 * rng(), h * (0.2 + 0.6 * rng())); }
  for (let i = 0; i < 1500 * amount; i++) { const v = rng() < 0.5 ? 60 : 235; g.fillStyle = rgba(v, v, v, 0.07); g.fillRect(x + rng() * w, y + rng() * h, 2, 2); }
  g.restore();
}
const fill = (g: CanvasRenderingContext2D, r: SignRegion, color: string) => { const [x, y, w, h] = REGIONS[r]; g.fillStyle = color; g.fillRect(x, y, w, h); };

/**
 * The station's lettering (signAtlas.ts), after the 1970s–80s photos: the bar's front wall, its cream room,
 * the ferry's weekend-trips board, the striped awning of the Cortijo house, and the "El ANCON de LOIZA"
 * sign drawn from docs/assets. The SVG loads asynchronously; `ready` resolves once it is painted in.
 */
export function paintSigns(): { canvas: HTMLCanvasElement; ready: Promise<void> } {
  const [c, g] = canvas(ATLAS.w, ATLAS.h);
  g.fillStyle = '#e7ece3'; g.fillRect(0, 0, ATLAS.w, ATLAS.h);
  fill(g, 'barFront', '#7a2b2c');
  letter(g, 'barFront', [
    { text: 'BAR RESTAURANT.', color: '#b4cf8c', gap: 0 }, { text: 'EL ANCON', color: '#eea48f', gap: 0.25 },
    { text: 'Mariscos', color: '#f1ece6', font: 'italic 700 100px "Brush Script MT", "Snell Roundhand", cursive', gap: 0.45 },
    { text: 'HIELO', color: '#a6d4cf', gap: 0.2 },
  ], 0.5, 0.7);
  weather(g, 'barFront', 1, 1.4);
  fill(g, 'barRest', '#e9e1cb');
  letter(g, 'barRest', [{ text: 'BAR REST.', color: '#4c8f6d', gap: 0 }, { text: 'EL ANCON', color: '#c8432f' }], 0.6, 0.78);
  weather(g, 'barRest', 2);
  fill(g, 'hielo', '#e9e1cb');
  letter(g, 'hielo', [{ text: 'HIELO', color: '#8fb6cf' }], 0.62, 0.8, '#3d5a6c');
  weather(g, 'hielo', 3);
  {
    const [x, y, w, h] = REGIONS.paseos;
    fill(g, 'paseos', '#f3efe6');
    g.strokeStyle = '#b8322a'; g.lineWidth = 5; g.strokeRect(x + 6, y + 6, w - 12, h - 12);
    const line = (t: string, color: string, cy: number, size: number) => {
      g.font = `800 ${size}px Arial, sans-serif`; const tw = g.measureText(t).width, k = Math.min(1, (w - 40) / tw);
      g.save(); g.translate(x + w / 2 - (tw * k) / 2, y + cy); g.scale(k, 1); g.fillStyle = color; g.fillText(t, 0, 0); g.restore();
    };
    line('PASEOS FINES DE SEMANA', '#2a2622', 52, 44);
    line('DIAS FERIADOS   TARIFA $2.00', '#2a2622', 112, 34);
    line('PASEOS A GRUPOS POR ACUERDO', '#b8322a', 172, 34);
    weather(g, 'paseos', 4, 0.6);
  }
  {
    const [x, y, w, h] = REGIONS.stripes, n = 16;
    for (let i = 0; i < n; i++) { g.fillStyle = i % 2 ? '#efe8da' : '#c4402f'; g.fillRect(x + (i * w) / n, y, w / n + 1, h); }
    weather(g, 'stripes', 5, 0.5);
  }
  const ready = new Promise<void>((done) => {
    const img = new Image();
    img.onload = () => {
      const [x, y, w, h] = REGIONS.loiza;
      g.drawImage(img, 0, 30, 926, 140, x, y, w, h);
      weather(g, 'loiza', 6, 0.8);
      done();
    };
    img.onerror = () => done();
    img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(signSvg)}`;
  });
  return { canvas: c, ready };
}
