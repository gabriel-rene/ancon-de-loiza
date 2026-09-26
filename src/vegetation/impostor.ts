import * as THREE from 'three';

type PartIn = { geometry: THREE.BufferGeometry; material: THREE.Material };
type Tinted = THREE.Material & { map?: THREE.Texture | null; color?: THREE.Color; vertexColors?: boolean };

const _clear = new THREE.Color();

/**
 * Card geometry: two quads crossed at 90° through the trunk axis (x = z = 0), each spanning
 * [-halfW, halfW] × [minY, maxY]. UVs 0..1 (u across, v up), aFlex = uv.y, normals bent outward
 * from a point at 60 % of the height and blended 50 % with +Y (reads as a rounded crown).
 */
export function buildCardGeometry(halfW: number, minY: number, maxY: number): THREE.BufferGeometry {
  const pos: number[] = [], uv: number[] = [], nrm: number[] = [], flex: number[] = [], idx: number[] = [];
  const cy = minY + 0.6 * (maxY - minY), n = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0);
  for (let q = 0; q < 2; q++) {
    const base = pos.length / 3;
    for (let j = 0; j < 2; j++) for (let i = 0; i < 2; i++) {
      const a = (i * 2 - 1) * halfW, y = j ? maxY : minY;
      const x = q === 0 ? a : 0, z = q === 0 ? 0 : a;
      pos.push(x, y, z); uv.push(i, j); flex.push(j);
      n.set(x, y - cy, z);
      if (n.lengthSq() < 1e-8) n.copy(up); else n.normalize();
      n.lerp(up, 0.5).normalize();
      nrm.push(n.x, n.y, n.z);
    }
    idx.push(base, base + 1, base + 3, base, base + 3, base + 2);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nrm, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setAttribute('aFlex', new THREE.Float32BufferAttribute(flex, 1));
  g.setIndex(idx);
  g.computeBoundingBox(); g.computeBoundingSphere();
  return g;
}

/**
 * Bake a side view of a plant (unlit albedo, alpha = coverage) into an sRGB, mipmapped texture
 * and build the matching crossed-card geometry. Browser-only (needs a live renderer).
 */
export function bakeImpostor(renderer: THREE.WebGLRenderer, parts: PartIn[], size = 256): { texture: THREE.Texture; card: THREE.BufferGeometry } {
  const box = new THREE.Box3(), tmp = new THREE.Box3();
  for (const p of parts) {
    if (!p.geometry.boundingBox) p.geometry.computeBoundingBox();
    box.union(tmp.copy(p.geometry.boundingBox!));
  }
  const halfW = Math.max(Math.abs(box.min.x), Math.abs(box.max.x), Math.abs(box.min.z), Math.abs(box.max.z), 0.01);
  const minY = box.min.y, maxY = Math.max(box.max.y, minY + 0.01);
  const aspect = (maxY - minY) / (2 * halfW);
  const w = size, h = Math.max(4, Math.min(size * 4, Math.round(size * aspect)));

  const target = new THREE.WebGLRenderTarget(w, h, {
    colorSpace: THREE.SRGBColorSpace, generateMipmaps: true,
    minFilter: THREE.LinearMipmapLinearFilter, magFilter: THREE.LinearFilter,
  });
  // Looking along -Z from y = 0, so the ortho frame's top/bottom are world Y directly.
  const cam = new THREE.OrthographicCamera(-halfW, halfW, maxY, minY, 0.01, 4 * halfW + 2);
  cam.position.set(0, 0, 2 * halfW + 1); cam.updateMatrixWorld();

  const scene = new THREE.Scene();
  const mats: THREE.MeshBasicMaterial[] = [];
  let tint = new THREE.Color(0.12, 0.16, 0.07);
  for (const p of parts) {
    const src = p.material as Tinted;
    const m = new THREE.MeshBasicMaterial({
      map: src.map ?? null, alphaTest: src.alphaTest > 0 ? src.alphaTest : 0.5,
      color: src.color ?? 0xffffff, vertexColors: !!src.vertexColors, side: THREE.DoubleSide,
    });
    mats.push(m);
    if (src.color) tint = src.color;
    scene.add(new THREE.Mesh(p.geometry, m));
  }

  const prevTarget = renderer.getRenderTarget();
  const prevAlpha = renderer.getClearAlpha();
  renderer.getClearColor(_clear);
  const prevColor = _clear.clone();
  const prevAutoClear = renderer.autoClear;
  const prevShadowAuto = renderer.shadowMap.autoUpdate;
  // Clear to the (last) part's tint with alpha 0 so mip/bilinear filtering at the silhouette
  // bleeds foliage colour rather than black into the card edges.
  renderer.setRenderTarget(target);
  renderer.setClearColor(tint, 0);
  renderer.autoClear = true;
  renderer.shadowMap.autoUpdate = false;
  renderer.clear(true, true, true);
  renderer.render(scene, cam);
  renderer.setRenderTarget(prevTarget);
  renderer.setClearColor(prevColor, prevAlpha);
  renderer.autoClear = prevAutoClear;
  renderer.shadowMap.autoUpdate = prevShadowAuto;

  for (const m of mats) m.dispose();
  const texture = target.texture;
  texture.name = 'impostor';
  // The render target owns the GL texture; disposing the texture must release the target too.
  texture.addEventListener('dispose', () => target.dispose());
  return { texture, card: buildCardGeometry(halfW, minY, maxY) };
}
