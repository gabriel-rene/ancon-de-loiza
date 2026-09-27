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
