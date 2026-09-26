import { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import type { WorldFields } from '../terrain/fields';
import { makeTerrainMaterial } from './terrainMaterial';
import { makeInfoTexture } from './useWorldFields';

function buildGeometry(f: WorldFields, holeHalf = 0) {
  const { size, cell, minX } = f.grid;
  const span = cell * (size - 1);
  const geom = new THREE.PlaneGeometry(span, span, size - 1, size - 1);
  geom.rotateX(-Math.PI / 2);
  geom.translate(minX + cell / 2 + span / 2, 0, minX + cell / 2 + span / 2);
  const pos = geom.attributes.position as THREE.BufferAttribute;
  for (let k = 0; k < pos.count; k++) {
    let y = f.height[k];
    const x = pos.getX(k), z = pos.getZ(k);
    if (holeHalf > 0 && Math.abs(x) < holeHalf && Math.abs(z) < holeHalf) y -= 40; // hidden under near terrain
    pos.setY(k, y);
  }
  geom.computeVertexNormals();
  return geom;
}

function TerrainMesh({ f, holeHalf = 0, shadows }: { f: WorldFields; holeHalf?: number; shadows: boolean }) {
  const { geom, mat } = useMemo(() => {
    const extent = f.grid.cell * f.grid.size;
    const tex = makeInfoTexture(f.info, f.grid.size);
    return { geom: buildGeometry(f, holeHalf), mat: makeTerrainMaterial(tex, new THREE.Vector4(f.grid.minX, f.grid.minZ, extent, 0)) };
  }, [f, holeHalf]);
  useEffect(() => () => { geom.dispose(); mat.dispose(); }, [geom, mat]);
  return <mesh geometry={geom} material={mat} receiveShadow={shadows} castShadow={false} />;
}

export function Terrain({ near, far, shadows }: { near: WorldFields; far: WorldFields; shadows: boolean }) {
  const holeHalf = (near.grid.cell * near.grid.size) / 2 - 20;
  return (
    <group>
      <TerrainMesh f={near} shadows={shadows} />
      <TerrainMesh f={far} holeHalf={holeHalf} shadows={false} />
    </group>
  );
}
