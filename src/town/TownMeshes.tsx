import { useEffect, useMemo } from 'react';
import type { Era } from '../data/eras';
import { infraMaterials } from '../infrastructure/materials';
import type { InfraMaterialId } from '../infrastructure/parts';
import { sampleField, type WorldFields } from '../terrain/fields';
import { buildTown } from './build';
import { eraTown } from './town';

/**
 * Phase 4b: the era's houses and the church, ≤ 5 merged meshes (the 4a infrastructure materials). Built once
 * per era and tier; heights read the tier's rendered terrain (`near`). Streets and yard dirt go to the 4a
 * ground mask (Infrastructure.tsx); plants keep out and the plaza trees are added in Vegetation.tsx.
 */
export function Town({ near, era, castShadow }: { near: WorldFields; era: Era; castShadow: boolean }) {
  const bank = era.river.bankOffset.value;
  const town = useMemo(() => eraTown(bank, era), [bank, era]);
  const parts = useMemo(() => buildTown(town, (x, z) => sampleField(near, near.height, x, z)), [town, near]);
  useEffect(() => () => { for (const g of Object.values(parts)) g?.dispose(); }, [parts]);
  const mats = infraMaterials();
  return (
    <group>
      {(Object.keys(parts) as InfraMaterialId[]).map((id) => (
        <mesh key={id} geometry={parts[id]} material={mats[id]} castShadow={castShadow} receiveShadow />
      ))}
    </group>
  );
}
