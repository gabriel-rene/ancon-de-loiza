import { cellRng } from '../vegetation/rng';

/*
 * Procedural vessel textures (browser-only: they need a 2D canvas). Painted near-neutral so the
 * per-plank vertex colours carry the tone; the map only adds grain, knots, weathering and nails.
 */

const SIZE = 1024;

function canvas(w: number, h: number) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return c;
}

/** Draw `fn` at every ±SIZE offset so strokes crossing an edge wrap around (seamless tile). */
function wrapped(g: CanvasRenderingContext2D, fn: () => void) {
  for (const dx of [-SIZE, 0, SIZE]) for (const dy of [-SIZE, 0, SIZE]) {
    g.save(); g.translate(dx, dy); fn(); g.restore();
  }
}

/**
 * Weathered plank detail map, 1024 × 1024 = TEX_M × TEX_M metres (a 0.25 m plank is 128 px). The
 * grain runs along the canvas v axis (worldUv puts v along each piece's grain). Near-white fill so
 * the WOOD vertex colours carry the albedo: 2 000 darker wavering grain streaks, 25 knots, soft pale
 * blotches, grey-white sun bleaching, water stains and drying checks. No nails: the tile is shared
 * by every face and would not line up with the planks.
 */
export function paintPlanks(): HTMLCanvasElement {
  const c = canvas(SIZE, SIZE), g = c.getContext('2d')!;
  const r = cellRng(0, 0, 7101);
  g.fillStyle = '#f4f1ec';
  g.fillRect(0, 0, SIZE, SIZE);

  // Broad tonal drift along the grain: slow bands so the base is never flat.
  for (let i = 0; i < 60; i++) {
    const x = r() * SIZE, w = 20 + 120 * r(), a = 0.03 + 0.05 * r();
    const col = r() < 0.5 ? `rgba(120,112,100,${a})` : `rgba(255,255,255,${a})`;
    wrapped(g, () => { g.fillStyle = col; g.fillRect(x - w / 2, 0, w, SIZE); });
  }

  // Grain streaks: long thin strokes along v with a slight sinusoidal waver.
  for (let i = 0; i < 2000; i++) {
    const x = r() * SIZE, y = r() * SIZE, len = 40 + 360 * r(), lw = 1 + r();
    const a = 0.05 + 0.13 * r(), amp = 0.6 + 2.2 * r(), freq = (2 * Math.PI) / (120 + 260 * r()), ph = r() * 6.3;
    const col = `rgba(118,108,96,${a.toFixed(3)})`;
    wrapped(g, () => {
      g.strokeStyle = col; g.lineWidth = lw; g.lineCap = 'round';
      g.beginPath();
      for (let s = 0; s <= len; s += 8) {
        const px = x + amp * Math.sin(ph + s * freq), py = y + s;
        if (s === 0) g.moveTo(px, py); else g.lineTo(px, py);
      }
      g.stroke();
    });
  }

  // Knots: small dark cores stretched along the grain, faint growth rings, a dark tail of
  // disturbed grain running away from them in both directions.
  for (let i = 0; i < 25; i++) {
    const x = r() * SIZE, y = r() * SIZE, rx = 3 + 4 * r(), ry = rx * (1.8 + 1.2 * r()), rings = 2 + (r() < 0.5 ? 1 : 0), tail = 30 + 60 * r();
    wrapped(g, () => {
      const tg = g.createLinearGradient(x, y - tail, x, y + tail);
      tg.addColorStop(0, 'rgba(96,80,64,0)'); tg.addColorStop(0.5, 'rgba(96,80,64,0.22)'); tg.addColorStop(1, 'rgba(96,80,64,0)');
      g.fillStyle = tg; g.fillRect(x - rx * 1.6, y - tail, rx * 3.2, 2 * tail);
      for (let k = rings; k >= 1; k--) {
        g.strokeStyle = `rgba(92,76,60,${0.1 + 0.05 * k})`; g.lineWidth = 1;
        g.beginPath(); g.ellipse(x, y, rx + 2 * k, ry + 5 * k, 0, 0, 2 * Math.PI); g.stroke();
      }
      g.save(); g.translate(x, y); g.scale(1, ry / rx);
      const grad = g.createRadialGradient(0, 0, 0, 0, 0, rx);
      grad.addColorStop(0, 'rgba(48,36,27,0.8)'); grad.addColorStop(0.75, 'rgba(70,56,43,0.55)'); grad.addColorStop(1, 'rgba(70,56,43,0)');
      g.fillStyle = grad;
      g.beginPath(); g.arc(0, 0, rx, 0, 2 * Math.PI); g.fill(); g.restore();
    });
  }

  // Weathering: soft light blotches, then silver-grey bleaching (sun + rain on exposed timber).
  for (let i = 0; i < 70; i++) {
    const x = r() * SIZE, y = r() * SIZE, rad = 30 + 110 * r();
    wrapped(g, () => {
      const grad = g.createRadialGradient(x, y, 0, x, y, rad);
      grad.addColorStop(0, 'rgba(255,255,255,0.08)'); grad.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = grad; g.fillRect(x - rad, y - rad, 2 * rad, 2 * rad);
    });
  }
  for (let i = 0; i < 40; i++) {
    const x = r() * SIZE, y = r() * SIZE, w = 30 + 90 * r(), h = 120 + 400 * r();
    wrapped(g, () => {
      g.save(); g.translate(x, y); g.scale(w / h, 1);
      const grad = g.createRadialGradient(0, 0, 0, 0, 0, h / 2);
      grad.addColorStop(0, 'rgba(236,238,238,0.35)'); grad.addColorStop(1, 'rgba(236,238,238,0)');
      g.fillStyle = grad;
      g.beginPath(); g.arc(0, 0, h / 2, 0, 2 * Math.PI); g.fill(); g.restore();
    });
  }
  // Water staining: long soft dark streaks along the grain where rain and bilge water run.
  for (let i = 0; i < 26; i++) {
    const x = r() * SIZE, y = r() * SIZE, w = 8 + 30 * r(), h = 200 + 500 * r(), a = 0.05 + 0.07 * r();
    wrapped(g, () => {
      const grad = g.createLinearGradient(x, y, x, y + h);
      grad.addColorStop(0, 'rgba(80,66,52,0)'); grad.addColorStop(0.5, `rgba(80,66,52,${a.toFixed(3)})`); grad.addColorStop(1, 'rgba(80,66,52,0)');
      g.fillStyle = grad; g.fillRect(x - w / 2, y, w, h);
    });
  }
  // Fine dark checks (drying cracks) along the grain.
  for (let i = 0; i < 160; i++) {
    const x = r() * SIZE, y = r() * SIZE, len = 10 + 50 * r(), dx = (r() - 0.5) * 1.5;
    wrapped(g, () => {
      g.strokeStyle = 'rgba(60,48,38,0.35)'; g.lineWidth = 0.8;
      g.beginPath(); g.moveTo(x, y); g.lineTo(x + dx, y + len); g.stroke();
    });
  }

  return c;
}

/**
 * Painted steel plate detail map, 1024 × 1024 = TEX_M × TEX_M metres. Light neutral fill so the
 * STEEL vertex colours carry the tone: mottled paint wear, rust drip streaks running down canvas v
 * (half start on two plate-edge lines per tile), pitting and a few bright scratches.
 */
export function paintSteel(): HTMLCanvasElement {
  const c = canvas(SIZE, SIZE), g = c.getContext('2d')!;
  const r = cellRng(0, 0, 7202);
  g.fillStyle = '#c9c9c2';
  g.fillRect(0, 0, SIZE, SIZE);

  // Mottled paint wear: soft darker and lighter blotches.
  for (let i = 0; i < 400; i++) {
    const x = r() * SIZE, y = r() * SIZE, rad = 12 + 90 * r(), a = 0.04 + 0.06 * r();
    const rgb = r() < 0.55 ? '70,68,62' : '245,245,240';
    wrapped(g, () => {
      const grad = g.createRadialGradient(x, y, 0, x, y, rad);
      grad.addColorStop(0, `rgba(${rgb},${a.toFixed(3)})`); grad.addColorStop(1, `rgba(${rgb},0)`);
      g.fillStyle = grad; g.fillRect(x - rad, y - rad, 2 * rad, 2 * rad);
    });
  }

  // Broad faint rust washes (rain carrying rust down the plate).
  for (let i = 0; i < 30; i++) {
    const x = r() * SIZE, y = r() * SIZE, w = 20 + 40 * r(), len = 100 + 200 * r(), a = 0.05 + 0.05 * r();
    wrapped(g, () => {
      const grad = g.createLinearGradient(x, y, x, y + len);
      grad.addColorStop(0, 'rgba(138,74,34,0)'); grad.addColorStop(0.25, `rgba(138,74,34,${a.toFixed(3)})`); grad.addColorStop(1, 'rgba(138,74,34,0)');
      g.fillStyle = grad;
      g.beginPath(); g.ellipse(x, y + len / 2, w / 2, len / 2, 0, 0, 2 * Math.PI); g.fill();
    });
  }
  // Rust drips: run down canvas v (down the hull: plates map v upward), tapering and wandering, from a
  // source; half of them start on the two plate-edge lines per tile (rows 0.15 and 0.65 fall on the
  // hull's deck edge at y ≈ 0.7 m and 1.7 m).
  const edges = [SIZE * 0.15, SIZE * 0.65];
  for (let i = 0; i < 120; i++) {
    const x = r() * SIZE, y = i % 2 === 0 ? edges[i % 4 === 0 ? 0 : 1] + 4 * r() : r() * SIZE;
    const w = 2 + 3 * r(), len = 30 + 170 * r(), a = 0.15 + 0.3 * r(), ph = r() * 6.3, amp = 0.5 + 1.5 * r();
    const pts: [number, number][] = [];
    for (let s = 0; s <= 12; s++) { const t = s / 12; pts.push([x + amp * Math.sin(ph + t * 5) * t, y + t * len]); }
    wrapped(g, () => {
      const grad = g.createLinearGradient(x, y, x, y + len);
      grad.addColorStop(0, `rgba(138,74,34,${a.toFixed(3)})`); grad.addColorStop(0.4, `rgba(138,74,34,${(a * 0.6).toFixed(3)})`);
      grad.addColorStop(1, 'rgba(138,74,34,0)');
      g.fillStyle = grad;
      g.beginPath();
      pts.forEach(([px, py], k) => { const hw = (w / 2) * (1 - 0.7 * (k / 12)); if (k === 0) g.moveTo(px - hw, py); else g.lineTo(px - hw, py); });
      for (let k = 12; k >= 0; k--) { const [px, py] = pts[k], hw = (w / 2) * (1 - 0.7 * (k / 12)); g.lineTo(px + hw, py); }
      g.closePath(); g.fill();
    });
  }
  // Rust along the plate-edge lines themselves (the seam weeps where the paint cracked).
  for (const ey of edges) for (let i = 0; i < 40; i++) {
    const x = r() * SIZE, w = 10 + 50 * r(), a = 0.08 + 0.12 * r(), h = 2 + 2 * r();
    wrapped(g, () => { g.fillStyle = `rgba(120,62,28,${a.toFixed(3)})`; g.fillRect(x, ey - 1, w, h); });
  }

  // Pitting: one-pixel dark pits.
  for (let i = 0; i < 3000; i++) {
    const x = Math.floor(r() * SIZE), y = Math.floor(r() * SIZE), a = 0.2 + 0.4 * r();
    g.fillStyle = `rgba(52,44,38,${a.toFixed(3)})`; g.fillRect(x, y, 1, 1);
  }

  // A few bright scratches (bare steel through the paint).
  for (let i = 0; i < 24; i++) {
    const x = r() * SIZE, y = r() * SIZE, len = 20 + 80 * r(), ang = r() * Math.PI;
    wrapped(g, () => {
      g.strokeStyle = 'rgba(250,250,245,0.25)'; g.lineWidth = 1;
      g.beginPath(); g.moveTo(x, y); g.lineTo(x + len * Math.cos(ang), y + len * Math.sin(ang)); g.stroke();
    });
  }
  return c;
}
