import { expect, test } from '@playwright/test';

const ERAS = ['1840', '1900', '1925', '1935', '1959', '1975', '1984', '1986'];
type Live = Record<'texture' | 'buffer' | 'framebuffer' | 'renderbuffer' | 'program' | 'vertexArray', number>;
declare global { interface Window { __GL_LIVE__?: Live } }

// Every era switch rebuilds the ferry, its ropes and crew and re-renders the sky environment. After one
// warm-up cycle (module caches: vessel materials, figure geometries, placements, fields), further cycles
// must leave the GPU exactly where they found it — raw GL objects and renderer.info alike.
test('cycling every era twice leaks no GPU resources', async ({ page }) => {
  test.setTimeout(300_000);
  await page.addInitScript(() => {
    const live: Live = (window.__GL_LIVE__ = { texture: 0, buffer: 0, framebuffer: 0, renderbuffer: 0, program: 0, vertexArray: 0 });
    for (const P of [WebGLRenderingContext.prototype, WebGL2RenderingContext.prototype] as unknown as Record<string, (...a: unknown[]) => unknown>[]) {
      for (const k of Object.keys(live) as (keyof Live)[]) {
        const K = k[0].toUpperCase() + k.slice(1), c = P[`create${K}`], d = P[`delete${K}`];
        if (!c || !d) continue;
        P[`create${K}`] = function (this: unknown, ...a: unknown[]) { const r = c.apply(this, a); if (r) live[k]++; return r; };
        P[`delete${K}`] = function (this: unknown, o: unknown) { if (o) live[k]--; return d.call(this, o); };
      }
    }
  });
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  await page.goto('?era=1840&freeze=1&q=medium&debug=1');
  await page.waitForFunction(() => window.__ANCON_READY__ === true, null, { timeout: 90_000 });
  const frames = (n: number) => page.evaluate((n) => new Promise<void>((r) => { let i = 0; const f = () => (++i >= n ? r() : requestAnimationFrame(f)); requestAnimationFrame(f); }), n);
  const snap = () => page.evaluate(() => ({ ...window.__GL_LIVE__!, geometries: window.__ANCON_GL__!.memory.geometries, textures: window.__ANCON_GL__!.memory.textures }));
  const rail = page.getByRole('navigation', { name: 'Choose an era' });
  const cycle = async () => {
    for (const id of [...ERAS.slice(1), ERAS[0]]) {
      await rail.locator('.decade-rail__btn', { hasText: id }).click();
      await frames(6);
    }
    await frames(10);
  };
  await cycle();                        // warm-up: first visits fill the module caches
  const baseline = await snap();
  await cycle(); await cycle();
  expect(await snap()).toEqual(baseline);
  expect(errors).toEqual([]);
});
