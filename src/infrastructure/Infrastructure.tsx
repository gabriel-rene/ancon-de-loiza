import { useEffect, useMemo } from 'react';
import { waterAt } from '../ancon/geometry';
import type { Era } from '../data/eras';
import geo from '../data/geo/loiza.json';
import type { GeoBundle } from '../data/geo/types';
import { groundUniforms, NO_GROUND } from '../scene/groundUniforms';
import { makeInfoTexture } from '../scene/useWorldFields';
import { sampleField, WATER, type WorldFields } from '../terrain/fields';
import { landingPadsFor, placementFields } from '../terrain/placementFields';
import { buildInfrastructure } from './build';
import { groundMask, SURFACE_INDEX } from './groundMask';
import { infraMaterials, roadMaterial } from './materials';
import type { InfraMaterialId } from './parts';
import { bridgeWay, eraRoads } from './roads';
import { eraTown } from '../town/town';

const G = geo as unknown as GeoBundle;
const BRIDGE_WAY_POINTS = bridgeWay(G);

/**
 * Phase 4a: roads, landings, station and bridge for the current era. Geometry is built once per era and
 * tier (≤ 5 merged meshes + ≤ 2 road strips, one per surface); minor roads and trodden dirt go to the terrain as the
 * uGround mask. Heights read the tier's rendered terrain (`near`); water tests read the fixed 512
 * placement fields, like the ferry, so nothing moves between tiers.
 */
export function Infrastructure({ near, era, castShadow }: { near: WorldFields; era: Era; castShadow: boolean }) {
  const bank = era.river.bankOffset.value;
  const place = useMemo(() => placementFields(bank, near), [bank, near]);
  const roads = useMemo(() => eraRoads(G, era), [era]);
  const out = useMemo(() => buildInfrastructure({
    infra: era.infrastructure, pads: landingPadsFor(bank), roads, bridgeWay: BRIDGE_WAY_POINTS,
    groundAt: (x, z) => sampleField(near, near.height, x, z),
    landAt: (x, z) => waterAt(place, x, z) === WATER.LAND,
    dryAt: (x, z) => waterAt(place, x, z) === WATER.LAND && sampleField(place, place.shore, x, z) >= 2,
    waterAt: (x, z) => waterAt(place, x, z),
  }), [era, bank, roads, near, place]);
  useEffect(() => () => { for (const g of Object.values(out.parts)) g?.dispose(); for (const r of out.roads) r.geometry.dispose(); }, [out]);

  // Phase 4b: the town streets next to shown houses and the yard/church/plaza dirt share the 4a mask.
  const town = useMemo(() => eraTown(bank, era), [bank, era]);
  const mask = useMemo(() => {
    const m = groundMask({ ...roads, simple: [...roads.simple, ...town.streets] }, [...out.dirt, ...town.dirt]);
    return { tex: makeInfoTexture(m.data, m.size), rect: m.rect };
  }, [roads, out, town]);
  useEffect(() => {
    groundUniforms.uGround.value = mask.tex;
    groundUniforms.uGroundRect.value.set(mask.rect[0], mask.rect[1], mask.rect[2], 0);
    groundUniforms.uRoadSurface.value = SURFACE_INDEX[era.infrastructure.roadSurface.value];
    return () => { groundUniforms.uGround.value = NO_GROUND; mask.tex.dispose(); };
  }, [mask, era]);

  const mats = infraMaterials();
  return (
    <group>
      {(Object.keys(out.parts) as InfraMaterialId[]).map((id) => (
        <mesh key={id} geometry={out.parts[id]} material={mats[id]} castShadow={castShadow} receiveShadow />
      ))}
      {out.roads.map((r) => <mesh key={r.surface} geometry={r.geometry} material={roadMaterial(r.surface)} receiveShadow />)}
    </group>
  );
}
