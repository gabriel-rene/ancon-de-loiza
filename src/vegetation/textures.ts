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

interface TwigLeafStyle {
  seed: number;
  twigs: number;
  /** Leaf pairs per shoot [min, max), spread over the outer `span` metres of it. */
  pairs: [number, number]; span: number;
  /** Leaf length (m) and width / length. */
  len: [number, number]; aspect: [number, number];
  /** Blade shape: 0 = narrow elliptic, acute tip; 1 = oval with a rounded, notched tip. */
  round: number;
  top: number[]; deep: number[]; under: number[];
  /** Probability a leaf shows its underside. */
  underP: number;
  twig: number[]; petiole: number[]; rib: number[];
  /** Pale notch at the tip (white mangrove); null for none. */
  notch: number[] | null;
}

/**
 * Shared basin-mangrove leaf card, 512×512 (≈ 1.2 m across), transparent: `twigs` twigs rise
 * from the lower half toward tips inside the card, each with 1–2 side shoots; every shoot carries
 * opposite leaf pairs crowded toward its end, shrinking toward the tip, and a terminal leaf.
 * Every other pair is foreshortened (decussate pairs seen in projection).
 */
function paintTwigLeaves(st: TwigLeafStyle): HTMLCanvasElement {
  const S = 512, px = S / 1.2;
  const c = canvas(S, S), g = c.getContext('2d')!;
  const rng = cellRng(0, 0, st.seed);
  const leaf = (x: number, y: number, ang: number, len: number, wid: number, under: boolean) => {
    g.save();
    g.translate(x, y); g.rotate(ang);
    const pet = len * 0.14, L = len - pet, hw = wid / 2, r = st.round;
    g.strokeStyle = rgb(st.petiole); g.lineWidth = Math.max(1, wid * 0.1);
    g.beginPath(); g.moveTo(0, 0); g.lineTo(pet, 0); g.stroke();
    const path = () => {
      g.beginPath(); g.moveTo(pet, 0);
      // Narrow elliptic (r = 0) → broad oval with a blunt, rounded tip (r = 1).
      g.bezierCurveTo(pet + L * lerp(0.1, 0.02, r), -hw * lerp(1.05, 1.25, r), pet + L * lerp(0.72, 0.95, r), -hw * lerp(1.0, 1.05, r), pet + L, 0);
      g.bezierCurveTo(pet + L * lerp(0.72, 0.95, r), hw * lerp(1.0, 1.05, r), pet + L * lerp(0.1, 0.02, r), hw * lerp(1.05, 1.25, r), pet, 0);
      g.closePath();
    };
    const v = 0.85 + 0.3 * rng();
    const base = (under ? st.under : mix(st.top, st.deep, rng())).map((q) => q * v);
    path(); g.fillStyle = rgb(base); g.fill();
    g.save(); path(); g.clip();
    // Soft light/shade across the blade (curved surface).
    const off = (rng() < 0.5 ? -1 : 1) * hw * 0.4;
    const grad = g.createLinearGradient(0, off - hw * 0.5, 0, off + hw * 0.5);
    const hi = mix(base, [235, 240, 220], under ? 0.25 : 0.18);
    grad.addColorStop(0, rgba(hi, 0)); grad.addColorStop(0.5, rgba(hi, 0.35 + 0.2 * rng())); grad.addColorStop(1, rgba(hi, 0));
    g.fillStyle = grad; g.fillRect(pet, off - hw * 0.5, L, hw);
    if (st.notch) {
      // Pale notch at the rounded tip (Laguncularia's paired glands / emarginate apex).
      g.fillStyle = rgba(st.notch, 0.85);
      g.beginPath(); g.ellipse(pet + L * 0.97, 0, L * 0.08, hw * 0.28, 0, 0, Math.PI * 2); g.fill();
    }
    path(); g.strokeStyle = rgb(base.map((q) => q * 0.65)); g.lineWidth = 1; g.stroke();
    g.restore();
    g.strokeStyle = rgb(mix(base, st.rib, 0.5)); g.lineWidth = Math.max(0.8, wid * 0.06);
    g.beginPath(); g.moveTo(pet, 0); g.lineTo(pet + L * 0.9, 0); g.stroke();
    g.restore();
  };
  // One leafy shoot from (bx, by) toward (tx, ty): opposite pairs over its outer part, shrinking
  // toward the tip, plus a terminal leaf.
  const shoot = (bx: number, by: number, tx: number, ty: number, width: number) => {
    const ang = Math.atan2(ty - by, tx - bx), len = Math.hypot(tx - bx, ty - by);
    g.strokeStyle = rgb(st.twig); g.lineWidth = width;
    g.beginPath(); g.moveTo(bx, by); g.quadraticCurveTo((bx + tx) / 2 + (rng() - 0.5) * 20, (by + ty) / 2, tx, ty); g.stroke();
    const pairs = st.pairs[0] + Math.floor(rng() * (st.pairs[1] - st.pairs[0]));
    const span = Math.min(len * 0.85, st.span * px);
    for (let pI = 0; pI < pairs; pI++) {
      const f = pI / Math.max(1, pairs - 1);
      const d = span * (1 - f);
      const x = tx - Math.cos(ang) * d, y = ty - Math.sin(ang) * d;
      const edgeOn = pI % 2 === 1;
      const L = lerp(st.len[0], st.len[1], rng()) * px * lerp(1, 0.6, f * f) * (edgeOn ? 0.85 : 1);
      const wid = L * lerp(st.aspect[0], st.aspect[1], rng()) * (edgeOn ? 0.6 : 1);
      const spread = lerp(1.15, 0.45, f) + (rng() - 0.5) * 0.4;
      for (const side of [-1, 1]) leaf(x, y, ang + side * spread + (rng() - 0.5) * 0.35, L, wid, rng() < st.underP);
    }
    const tl = lerp(st.len[0], st.len[1], 0.4) * px * 0.7;
    leaf(tx, ty, ang + (rng() - 0.5) * 0.3, tl, tl * st.aspect[0], false);
  };
  for (let k = 0; k < st.twigs; k++) {
    // Tips stratified over a 4 × 3 grid (upper ~70% of the card) so the card fills evenly.
    const cell = (k * 7) % 12;
    const tx = S * (0.14 + 0.72 * ((cell % 4) + 0.2 + 0.6 * rng()) / 4), ty = S * (0.06 + 0.64 * (Math.floor(cell / 4) + 0.15 + 0.7 * rng()) / 3);
    const bx = lerp(tx, S * (0.25 + 0.5 * rng()), 0.5), by = Math.min(S - 4, ty + S * (0.22 + 0.22 * rng()));
    // Side shoots first (the main shoot's leaves overlap their bases).
    const nSide = 1 + Math.floor(rng() * 2);
    for (let j = 0; j < nSide; j++) {
      const t = 0.35 + 0.3 * rng();
      const sx = lerp(bx, tx, t), sy = lerp(by, ty, t);
      const a = Math.atan2(ty - by, tx - bx) + (j % 2 ? 1 : -1) * (0.45 + 0.4 * rng());
      const l = Math.hypot(tx - bx, ty - by) * (0.45 + 0.2 * rng());
      shoot(sx, sy, sx + Math.cos(a) * l, sy + Math.sin(a) * l, 2);
    }
    shoot(bx, by, tx, ty, 3);
  }
  return c;
}

/**
 * Black-mangrove leaf card, 512×512 (≈ 1.2 m): opposite, narrow elliptic leaves 5–10 cm long,
 * dark grey-green (~#3a4a33) above; about a third show their pale silvery-grey salt-crusted
 * undersides (~#9aa393), which is what makes the crown read grey from a distance.
 */
export function paintBlackMangroveLeaves(): HTMLCanvasElement {
  return paintTwigLeaves({
    seed: 6161, twigs: 11, pairs: [8, 11], span: 0.2, len: [0.06, 0.1], aspect: [0.28, 0.36], round: 0,
    top: [58, 74, 51], deep: [40, 54, 36], under: [154, 163, 147], underP: 0.34,
    twig: [88, 78, 66], petiole: [96, 92, 70], rib: [150, 160, 130], notch: null,
  });
}

/**
 * White-mangrove leaf card, 512×512 (≈ 1.2 m): opposite, oval leaves with rounded tips
 * (5–10 cm), light yellow-green (~#7f9a45) with a paler notch at the tip and reddish petioles;
 * a few show the slightly paler underside.
 */
export function paintWhiteMangroveLeaves(): HTMLCanvasElement {
  return paintTwigLeaves({
    seed: 7171, twigs: 10, pairs: [6, 9], span: 0.18, len: [0.06, 0.1], aspect: [0.52, 0.62], round: 1,
    top: [127, 154, 69], deep: [98, 126, 50], under: [150, 170, 100], underP: 0.12,
    twig: [120, 96, 72], petiole: [150, 88, 60], rib: [176, 190, 120], notch: [196, 206, 140],
  });
}

/**
 * Buttonwood leaf card, 512×512, transparent: narrow, pointed (lanceolate) leaves, silvery
 * grey-green (~#8c9a7a) — the silky-haired coastal form — with a light sheen and some paler
 * undersides. Buttonwood leaves are alternate; at card scale the shared twig layout reads the
 * same. Its cards are 0.6–1.0 m, not 1.2 m, so the painted 6–11 cm maps to about 3–9 cm.
 */
export function paintButtonwoodLeaves(): HTMLCanvasElement {
  return paintTwigLeaves({
    seed: 8181, twigs: 11, pairs: [7, 10], span: 0.2, len: [0.06, 0.11], aspect: [0.2, 0.28], round: 0,
    top: [140, 154, 122], deep: [116, 130, 100], under: [178, 186, 166], underP: 0.3,
    twig: [72, 64, 56], petiole: [120, 118, 92], rib: [180, 188, 160], notch: null,
  });
}

/**
 * Sea-grape leaf card, 512×512 (≈ 0.9 m), transparent: a few short grey twigs from the bottom
 * carrying ~16 very large, round leathery leaves (15–23 cm) with a notched heart-shaped base,
 * olive-green (~#5d7a2e) with red-pink midrib and veins and a glossy highlight; ~8 % of leaves
 * fully red (~#8a3a28) and a few yellowing. Leaves overlap to fill most of a rounded
 * area so the card edge doesn't read.
 */
export function paintSeaGrapeLeaves(): HTMLCanvasElement {
  const S = 512, px = S / 0.9;
  const c = canvas(S, S), g = c.getContext('2d')!;
  const rng = cellRng(0, 0, 9191);
  const GREEN = [93, 122, 46], DEEP = [70, 96, 34], RED = [138, 58, 40], YELLOW = [150, 150, 60];
  const VEIN = [196, 110, 110], TWIG = [128, 120, 108];
  // Leaf centres: jittered 4 × 4 grid inside a disc, larger leaves low (older, outer), plus a few extra.
  const leaves: { x: number; y: number; R: number }[] = [];
  for (let j = 0; j < 4; j++) for (let i = 0; i < 4; i++) {
    const x = S * (0.2 + 0.6 * (i + 0.2 + 0.6 * rng()) / 4), y = S * (0.18 + 0.64 * (j + 0.2 + 0.6 * rng()) / 4);
    if (Math.hypot(x - S / 2, y - S / 2) > S * 0.4) continue;
    leaves.push({ x, y, R: lerp(0.085, 0.125, rng()) * px * lerp(0.9, 1.05, y / S) });
  }
  for (let k = 0; k < 3; k++) leaves.push({ x: S * (0.35 + 0.3 * rng()), y: S * (0.3 + 0.4 * rng()), R: lerp(0.085, 0.115, rng()) * px });
  // Twigs from the bottom centre to each leaf's base (drawn first; the leaves overlap them).
  const bx = S * (0.45 + 0.1 * rng()), by = S - 6;
  g.strokeStyle = rgb(TWIG); g.lineCap = 'round';
  for (const L of leaves) {
    g.lineWidth = 3 + 2 * rng();
    g.beginPath(); g.moveTo(bx, by);
    g.quadraticCurveTo(lerp(bx, L.x, 0.3) + (rng() - 0.5) * 40, lerp(by, L.y, 0.6), L.x, L.y + L.R * 0.8);
    g.stroke();
  }
  // Leaves back to front (higher first, so lower, nearer leaves overlap them).
  leaves.sort((a, b) => a.y - b.y);
  for (const L of leaves) {
    const r = rng();
    const base = r < 0.08 ? RED : r < 0.14 ? mix(GREEN, YELLOW, 0.6) : mix(GREEN, DEEP, rng());
    const v = 0.88 + 0.24 * rng();
    const col = base.map((q) => q * v);
    g.save();
    g.translate(L.x, L.y);
    // Petiole points down-ish toward the twigs; leaf tilts a little either way.
    g.rotate(Math.PI / 2 + (rng() - 0.5) * 0.8);
    const R = L.R, sx = 1 + 0.12 * rng(); // slightly broader than long
    // Heart-shaped round blade: circle minus a notch at the base (+x = toward the petiole).
    const path = () => {
      g.beginPath();
      g.moveTo(R * 0.72, 0);
      g.lineTo(R * Math.cos(0.32), R * sx * Math.sin(0.32));
      g.ellipse(0, 0, R, R * sx, 0, 0.32, Math.PI * 2 - 0.32);
      g.closePath();
    };
    path(); g.fillStyle = rgb(col); g.fill();
    g.save(); path(); g.clip();
    // Glossy leathery sheen: off-centre radial highlight, darker rim.
    const hx = (rng() - 0.5) * R * 0.6, hy = (rng() - 0.5) * R * 0.6;
    const grad = g.createRadialGradient(hx, hy, R * 0.05, hx, hy, R * 1.1);
    grad.addColorStop(0, rgba(mix(col, [240, 240, 215], 0.35), 0.7));
    grad.addColorStop(0.5, rgba(col, 0));
    grad.addColorStop(1, rgba(col.map((q) => q * 0.6), 0.6));
    g.fillStyle = grad; g.fillRect(-R * 1.2, -R * 1.2, R * 2.4, R * 2.4);
    // Red-pink midrib and 4–5 pairs of curving lateral veins (paler on red leaves).
    const vein = rgba(base === RED ? [210, 140, 120] : VEIN, 0.8);
    g.strokeStyle = vein; g.lineWidth = Math.max(1.5, R * 0.05);
    g.beginPath(); g.moveTo(R * 0.72, 0); g.lineTo(-R * 0.95, 0); g.stroke();
    g.lineWidth = Math.max(1, R * 0.025);
    const nv = 4 + Math.floor(rng() * 2);
    for (let k = 0; k < nv; k++) {
      const x0 = lerp(R * 0.6, -R * 0.6, (k + 0.5) / nv);
      for (const s of [-1, 1]) {
        g.beginPath(); g.moveTo(x0, 0);
        g.quadraticCurveTo(x0 - R * 0.15, s * R * sx * 0.5, x0 - R * 0.4, s * R * sx * 0.88);
        g.stroke();
      }
    }
    g.restore();
    path(); g.strokeStyle = rgb(col.map((q) => q * 0.55)); g.lineWidth = 1.5; g.stroke();
    // Stout petiole.
    g.strokeStyle = rgb(base === RED ? [150, 80, 60] : [130, 110, 80]); g.lineWidth = Math.max(2, R * 0.07);
    g.beginPath(); g.moveTo(R * 0.72, 0); g.lineTo(R * 0.95, 0); g.stroke();
    g.restore();
  }
  return c;
}

/**
 * Almond (Terminalia catappa) leaf card, 512×512 (≈ 1.2 m), transparent; lies flat at a branch
 * tip. Short grey twigs from the card centre end in 6 rosettes (one central, five around) of
 * 8–12 large obovate leaves (15–25 cm: narrow wedge base, broad rounded tip) radiating flat
 * from the twig end. Glossy dark green (~#2f5a1e) with a pale midrib, faint lateral veins and a
 * sheen stripe; ~8 % of leaves red, orange or yellow (turning before they fall — the geometry
 * tints whole cards on top of this).
 */
export function paintAlmondLeaves(): HTMLCanvasElement {
  const S = 512, px = S / 1.2;
  const c = canvas(S, S), g = c.getContext('2d')!;
  const rng = cellRng(0, 0, 9393);
  const GREEN = [47, 90, 30], DEEP = [32, 64, 20], RIB = [168, 186, 120], TWIG = [110, 102, 92];
  const TURN = [[172, 50, 30], [206, 108, 38], [196, 168, 60]];
  const leaf = (x: number, y: number, ang: number, len: number, wid: number) => {
    const r = rng();
    const turned = r < 0.08 ? TURN[Math.floor(rng() * 3)] : null;
    const v = 0.85 + 0.3 * rng();
    const col = (turned ?? mix(GREEN, DEEP, rng())).map((q) => q * v);
    g.save();
    g.translate(x, y); g.rotate(ang);
    const pet = len * 0.08, L = len - pet, hw = wid / 2;
    const path = () => {
      // Obovate: narrow wedge base, widest about 3/4 along, broad rounded tip.
      g.beginPath(); g.moveTo(pet, 0);
      g.bezierCurveTo(pet + L * 0.3, -hw * 0.35, pet + L * 0.5, -hw * 1.0, pet + L * 0.78, -hw * 0.98);
      g.bezierCurveTo(pet + L * 1.02, -hw * 0.9, pet + L * 1.04, -hw * 0.15, pet + L, 0);
      g.bezierCurveTo(pet + L * 1.04, hw * 0.15, pet + L * 1.02, hw * 0.9, pet + L * 0.78, hw * 0.98);
      g.bezierCurveTo(pet + L * 0.5, hw * 1.0, pet + L * 0.3, hw * 0.35, pet, 0);
      g.closePath();
    };
    g.strokeStyle = rgb(turned ? mix(col, [120, 80, 50], 0.4) : [96, 100, 60]); g.lineWidth = Math.max(1.5, wid * 0.08);
    g.beginPath(); g.moveTo(0, 0); g.lineTo(pet + 2, 0); g.stroke();
    path(); g.fillStyle = rgb(col); g.fill();
    g.save(); path(); g.clip();
    // Glossy: a soft highlight stripe to one side of the midrib, darker toward the margin.
    const off = (rng() < 0.5 ? -1 : 1) * hw * (0.25 + 0.2 * rng());
    const hi = mix(col, [236, 242, 220], 0.3);
    const grad = g.createLinearGradient(0, off - hw * 0.6, 0, off + hw * 0.6);
    grad.addColorStop(0, rgba(hi, 0)); grad.addColorStop(0.5, rgba(hi, 0.45 + 0.2 * rng())); grad.addColorStop(1, rgba(hi, 0));
    g.fillStyle = grad; g.fillRect(pet, off - hw * 0.6, L * 1.05, hw * 1.2);
    // Faint lateral veins, curving toward the tip.
    g.strokeStyle = rgba(mix(col, RIB, 0.45), 0.55); g.lineWidth = Math.max(0.8, wid * 0.02);
    const nv = 6 + Math.floor(rng() * 3);
    for (let k = 1; k <= nv; k++) {
      const x0 = pet + L * (0.1 + 0.8 * k / (nv + 1));
      for (const s of [-1, 1]) {
        g.beginPath(); g.moveTo(x0, 0); g.quadraticCurveTo(x0 + L * 0.06, s * hw * 0.45, x0 + L * 0.14, s * hw * 0.85); g.stroke();
      }
    }
    path(); g.strokeStyle = rgb(col.map((q) => q * 0.6)); g.lineWidth = 1.2; g.stroke();
    g.restore();
    // Pale midrib.
    g.strokeStyle = rgb(mix(col, RIB, 0.7)); g.lineWidth = Math.max(1, wid * 0.05);
    g.beginPath(); g.moveTo(pet, 0); g.lineTo(pet + L * 0.92, 0); g.stroke();
    g.restore();
  };
  // Rosette centres: one near the card centre, five in a ring (jittered).
  const cx = S / 2, cy = S / 2;
  const centres: [number, number][] = [[cx + (rng() - 0.5) * 20, cy + (rng() - 0.5) * 20]];
  const a0 = rng() * Math.PI * 2;
  for (let k = 0; k < 5; k++) {
    const a = a0 + (k / 5) * Math.PI * 2 + (rng() - 0.5) * 0.5, d = S * lerp(0.22, 0.27, rng());
    centres.push([cx + Math.cos(a) * d, cy + Math.sin(a) * d]);
  }
  // Twigs from the card centre to each rosette (the leaves overlap them).
  g.lineCap = 'round';
  for (const [x, y] of centres.slice(1)) {
    g.strokeStyle = rgb(TWIG.map((q) => q * (0.85 + 0.3 * rng()))); g.lineWidth = 4 + 2 * rng();
    g.beginPath(); g.moveTo(cx, cy); g.quadraticCurveTo((cx + x) / 2 + (rng() - 0.5) * 30, (cy + y) / 2 + (rng() - 0.5) * 30, x, y); g.stroke();
  }
  // Outer rosettes first; within a rosette, long (older, lower) leaves first.
  for (const [x, y] of [...centres.slice(1), centres[0]]) {
    const n = 8 + Math.floor(rng() * 5), ra = rng() * Math.PI * 2;
    // Keep leaves inside the card: shorten those pointing at a near edge.
    const leaves = Array.from({ length: n }, (_, k) => {
      const ang = ra + (k / n) * Math.PI * 2 + (rng() - 0.5) * 0.4;
      let len = lerp(0.15, 0.25, rng()) * px;
      const room = Math.min(...[[Math.cos(ang), x], [Math.sin(ang), y]].map(([d, p]) => (d > 0 ? (S - 4 - p) / d : d < 0 ? (p - 4) / -d : Infinity)));
      len = Math.min(len, room);
      return { ang, len };
    }).sort((p, q) => q.len - p.len);
    for (const L of leaves) leaf(x, y, L.ang, L.len, L.len * lerp(0.48, 0.58, rng()));
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

/* ---- Ground cover (Task 7): canvas bottom = clump base, since textures flip Y. ---- */

/** One tapered blade from (x0, y0) bending toward (x1, y1); `w` = base width (px). */
function blade(g: CanvasRenderingContext2D, x0: number, y0: number, x1: number, y1: number, bend: number, w: number, fill: string | CanvasGradient) {
  const mx = lerp(x0, x1, 0.5) + bend, my = lerp(y0, y1, 0.55);
  const dx = x1 - x0, dy = y1 - y0, L = Math.hypot(dx, dy) || 1, nx = -dy / L, ny = dx / L;
  g.beginPath();
  g.moveTo(x0 - nx * w / 2, y0 - ny * w / 2);
  g.quadraticCurveTo(mx - nx * w * 0.3, my - ny * w * 0.3, x1, y1);
  g.quadraticCurveTo(mx + nx * w * 0.3, my + ny * w * 0.3, x0 + nx * w / 2, y0 + ny * w / 2);
  g.closePath();
  g.fillStyle = fill; g.fill();
}

/**
 * Open-land grass tuft, 256×256 (≈ 0.75 m card), transparent: 40–60 tapered blades rising
 * from the bottom edge and fanning out, olive to straw green (#6b7a34…#a09a55), darker at the
 * base, a few dry straw tips.
 */
export function paintGrassBlades(): HTMLCanvasElement {
  const S = 256;
  const c = canvas(S, S), g = c.getContext('2d')!;
  const rng = cellRng(0, 0, 5151);
  const OLIVE = [107, 122, 52], STRAW = [160, 154, 85], DRY = [190, 170, 115], DARK = [62, 72, 30];
  const n = 40 + Math.floor(rng() * 21);
  for (let k = 0; k < n; k++) {
    const x0 = S * (0.18 + 0.64 * rng()), y0 = S;
    const spread = (x0 / S - 0.5) * 1.1 + (rng() - 0.5) * 0.5;       // outer blades lean outward
    const len = S * lerp(0.45, 0.97, rng() ** 0.7);
    const x1 = Math.min(S - 3, Math.max(3, x0 + spread * len * 0.6)), y1 = Math.max(3, y0 - len * lerp(0.8, 1, rng()));
    const col = mix(OLIVE, STRAW, rng()).map((q) => q * (0.85 + 0.3 * rng()));
    const grad = g.createLinearGradient(x0, y0, x1, y1);
    grad.addColorStop(0, rgb(mix(col, DARK, 0.55)));
    grad.addColorStop(0.45, rgb(col));
    grad.addColorStop(1, rgb(rng() < 0.18 ? DRY : mix(col, STRAW, 0.3)));
    blade(g, x0, y0, x1, y1, (rng() - 0.5) * 30, lerp(3.5, 7, rng()), grad);
  }
  return c;
}

/**
 * Reeds and sedges at the wet river edge, 128×512 (≈ 0.45 × 1.6 m card), transparent: 12–20
 * thin stems, a few arching leaf blades and 2–3 brown seed heads; green-brown.
 */
export function paintReedStems(): HTMLCanvasElement {
  const W = 128, Hh = 512;
  const c = canvas(W, Hh), g = c.getContext('2d')!;
  const rng = cellRng(0, 0, 5252);
  const GREEN = [96, 112, 56], BROWN = [128, 110, 70], DARK = [58, 62, 34], HEAD = [104, 72, 44];
  g.lineCap = 'round';
  const n = 12 + Math.floor(rng() * 9), tips: [number, number][] = [];
  for (let k = 0; k < n; k++) {
    const x0 = W * (0.3 + 0.4 * rng()), len = Hh * lerp(0.55, 0.97, rng());
    const x1 = Math.min(W - 4, Math.max(4, x0 + (x0 / W - 0.5) * 70 + (rng() - 0.5) * 30)), y1 = Hh - len;
    const col = mix(GREEN, BROWN, rng() * 0.7).map((q) => q * (0.85 + 0.3 * rng()));
    const grad = g.createLinearGradient(0, Hh, 0, y1);
    grad.addColorStop(0, rgb(mix(col, DARK, 0.5))); grad.addColorStop(1, rgb(mix(col, BROWN, 0.35)));
    g.strokeStyle = grad; g.lineWidth = lerp(2, 3.5, rng());
    g.beginPath(); g.moveTo(x0, Hh); g.quadraticCurveTo(lerp(x0, x1, 0.3), lerp(Hh, y1, 0.6), x1, y1); g.stroke();
    tips.push([x1, y1]);
  }
  // Arching leaf blades from the base, a few folding over.
  const nb = 5 + Math.floor(rng() * 4);
  for (let k = 0; k < nb; k++) {
    const x0 = W * (0.35 + 0.3 * rng()), side = rng() < 0.5 ? -1 : 1;
    const x1 = Math.min(W - 3, Math.max(3, x0 + side * W * lerp(0.25, 0.45, rng()))), y1 = Hh * lerp(0.25, 0.6, rng());
    const col = mix(GREEN, BROWN, rng() * 0.5).map((q) => q * (0.85 + 0.3 * rng()));
    const grad = g.createLinearGradient(x0, Hh, x1, y1);
    grad.addColorStop(0, rgb(mix(col, DARK, 0.5))); grad.addColorStop(1, rgb(col));
    blade(g, x0, Hh, x1, y1, -side * 18, lerp(5, 8, rng()), grad);
  }
  // Seed heads: 2–3 slender brown spikes on the tallest stems.
  tips.sort((a, b) => a[1] - b[1]);
  const nh = 2 + Math.floor(rng() * 2);
  for (let k = 0; k < Math.min(nh, tips.length); k++) {
    const [x, y] = tips[k], h = lerp(30, 50, rng());
    g.fillStyle = rgb(HEAD.map((q) => q * (0.85 + 0.3 * rng())));
    g.beginPath(); g.ellipse(x, y + h / 2, 3.5, h / 2, 0, 0, Math.PI * 2); g.fill();
  }
  return c;
}

/**
 * Beach morning glory (Ipomoea pes-caprae) runner, 256×256 (≈ 0.8 m card lying on the sand),
 * transparent: a trailing stem from the bottom centre (clump centre) to the top edge (runner
 * tip) carrying 8–12 two-lobed "goat's foot" leaves (~#3f6b2a) on short petioles, and 1–2
 * pink-purple funnel flowers (~#c05a9a) with a darker throat.
 */
export function paintVineLeaves(): HTMLCanvasElement {
  const S = 256;
  const c = canvas(S, S), g = c.getContext('2d')!;
  const rng = cellRng(0, 0, 5353);
  const LEAF = [63, 107, 42], PALE = [96, 136, 64], STEM = [120, 84, 70], FLOWER = [192, 90, 154], THROAT = [120, 40, 96];
  // Stem: a gentle S from bottom centre to the top.
  const x0 = S * 0.5, y0 = S - 2, x3 = S * (0.4 + 0.2 * rng()), y3 = 6;
  const c1 = [S * (0.3 + 0.15 * rng()), S * 0.65], c2 = [S * (0.55 + 0.15 * rng()), S * 0.3];
  const at = (t: number): [number, number] => {
    const u = 1 - t;
    return [u * u * u * x0 + 3 * u * u * t * c1[0] + 3 * u * t * t * c2[0] + t * t * t * x3,
      u * u * u * y0 + 3 * u * u * t * c1[1] + 3 * u * t * t * c2[1] + t * t * t * y3];
  };
  g.strokeStyle = rgb(STEM); g.lineWidth = 3; g.lineCap = 'round';
  g.beginPath(); g.moveTo(x0, y0); g.bezierCurveTo(c1[0], c1[1], c2[0], c2[1], x3, y3); g.stroke();
  const n = 8 + Math.floor(rng() * 5);
  const leaves: { x: number; y: number; a: number; R: number }[] = [];
  for (let k = 0; k < n; k++) {
    const t = (k + 0.3 + 0.4 * rng()) / n, [x, y] = at(t), side = k % 2 ? 1 : -1;
    const a = -Math.PI / 2 + side * lerp(0.6, 1.2, rng());       // petiole angle (up = -y), alternating
    const R = lerp(21, 29, rng()) * lerp(1.1, 0.8, t);             // smaller toward the tip
    const pl = R * 0.6, lx = x + Math.cos(a) * pl, ly = y + Math.sin(a) * pl;
    g.strokeStyle = rgb(STEM); g.lineWidth = 1.6;
    g.beginPath(); g.moveTo(x, y); g.lineTo(lx, ly); g.stroke();
    leaves.push({ x: lx + Math.cos(a) * R, y: ly + Math.sin(a) * R, a, R });
  }
  for (const L of leaves) {
    const col = mix(LEAF, PALE, rng() * 0.4).map((q) => q * (0.85 + 0.3 * rng()));
    g.save(); g.translate(L.x, L.y); g.rotate(L.a + Math.PI / 2); // local -y = away from the petiole
    const R = L.R;
    // Two rounded lobes with a notch at the tip (goat's foot), petiole at +y.
    g.beginPath();
    g.moveTo(0, R);
    g.bezierCurveTo(-R * 1.2, R * 0.7, -R * 1.25, -R * 0.9, -R * 0.35, -R * 0.95);
    g.quadraticCurveTo(-R * 0.1, -R * 0.9, 0, -R * 0.55);
    g.quadraticCurveTo(R * 0.1, -R * 0.9, R * 0.35, -R * 0.95);
    g.bezierCurveTo(R * 1.25, -R * 0.9, R * 1.2, R * 0.7, 0, R);
    g.closePath();
    const grad = g.createRadialGradient(-R * 0.2, -R * 0.2, R * 0.1, 0, 0, R * 1.2);
    grad.addColorStop(0, rgb(mix(col, [200, 210, 150], 0.25))); grad.addColorStop(1, rgb(col.map((q) => q * 0.75)));
    g.fillStyle = grad; g.fill();
    g.strokeStyle = rgba(mix(col, [210, 220, 170], 0.5), 0.7); g.lineWidth = 1.2;
    g.beginPath(); g.moveTo(0, R); g.lineTo(0, -R * 0.55); g.stroke();
    g.restore();
  }
  const nf = 1 + Math.floor(rng() * 2);
  for (let k = 0; k < nf; k++) {
    const [sx, sy] = at(lerp(0.3, 0.8, rng())), fx = sx + (rng() - 0.5) * 50, fy = sy + (rng() - 0.5) * 30, R = lerp(13, 17, rng());
    g.fillStyle = rgb(FLOWER.map((q) => q * (0.9 + 0.2 * rng())));
    g.beginPath();
    for (let i = 0; i <= 50; i++) {
      const a = (i / 50) * Math.PI * 2, r = R * (0.88 + 0.12 * Math.cos(a * 5));
      if (i === 0) g.moveTo(fx + r * Math.cos(a), fy + r * Math.sin(a)); else g.lineTo(fx + r * Math.cos(a), fy + r * Math.sin(a));
    }
    g.fill();
    const tg = g.createRadialGradient(fx, fy, 0, fx, fy, R * 0.55);
    tg.addColorStop(0, rgb(THROAT)); tg.addColorStop(1, rgba(FLOWER, 0));
    g.fillStyle = tg; g.beginPath(); g.arc(fx, fy, R * 0.55, 0, Math.PI * 2); g.fill();
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
