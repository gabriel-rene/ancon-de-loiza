import { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import { sampleField, type WorldFields } from '../../terrain/fields';
import { foliageTexture, paintCaneSide, paintCaneTop } from '../textures';
import { makePlantMaterials } from '../windMaterial';
import type { CaneLayout } from './caneFields';
import { buildCaneGeometry } from './caneMesh';

type Mats = { top: { material: THREE.Material; depth: THREE.Material }; sides: { material: THREE.Material; depth: THREE.Material } };
let mats: Mats | null = null;
/** Painted textures and wind materials: built once, kept for the app's life (like the species materials). */
function caneMaterials(): Mats {
  if (mats) return mats;
  // Top canvas is fully opaque (no cutout needed): a plain generated-mipmap CanvasTexture, not
  // foliageTexture's coverage-preserving mip chain — that chain is built for cards with genuine
  // alpha variation and can't find a stable rescale for a uniformly-opaque alpha channel (see
  // rulings note), which pinned mip alpha right at the alpha-test cutoff and alpha-tested the
  // whole top away at the fields-camera's distance. The top never needs alpha testing at all.
  const top = new THREE.CanvasTexture(paintCaneTop());
  top.colorSpace = THREE.SRGBColorSpace;
  top.wrapS = top.wrapT = THREE.RepeatWrapping;
  top.anisotropy = 8;
  top.needsUpdate = true;
  const side = foliageTexture(paintCaneSide(), 0.5, 'caneSide');
  side.wrapS = THREE.RepeatWrapping; side.wrapT = THREE.ClampToEdgeWrapping;
  mats = {
    top: makePlantMaterials({ part: 'foliage', map: top, color: 0xffffff, roughness: 0.85, translucency: 1.2, vertexColors: true }),
    sides: makePlantMaterials({ part: 'foliage', map: side, color: 0xffffff, roughness: 0.85, translucency: 1.2, alphaTest: 0.5, vertexColors: true }),
  };
  return mats;
}

/**
 * Sugar-cane fields (phase 2c): the shown cells of `layout` as two meshes (top, sides) standing on
 * the rendered terrain (`near` inside its extent, `far` beyond). Swayed by the shared wind.
 */
export function CaneFields({ layout, shown, near, far, castShadow }: {
  layout: CaneLayout; shown: Uint8Array; near: WorldFields; far: WorldFields; castShadow: boolean;
}) {
  const geo = useMemo(() => {
    const g = near.grid, x1 = g.minX + g.cell * g.size, z1 = g.minZ + g.cell * g.size;
    const heightAt = (x: number, z: number) =>
      x > g.minX && x < x1 && z > g.minZ && z < z1 ? sampleField(near, near.height, x, z) : sampleField(far, far.height, x, z);
    return buildCaneGeometry(layout, shown, heightAt);
  }, [layout, shown, near, far]);
  useEffect(() => () => { geo.top.dispose(); geo.sides.dispose(); }, [geo]);
  const m = caneMaterials();
  if (!geo.top.index!.count) return null;
  return <>
    <mesh name="cane-top" geometry={geo.top} material={m.top.material} customDepthMaterial={m.top.depth} castShadow={castShadow} receiveShadow />
    <mesh name="cane-sides" geometry={geo.sides} material={m.sides.material} customDepthMaterial={m.sides.depth} castShadow={castShadow} receiveShadow />
  </>;
}
