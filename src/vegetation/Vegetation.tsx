import { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import geo from '../data/geo/loiza.json';
import type { GeoBundle } from '../data/geo/types';
import type { Era } from '../data/eras';
import type { QualitySettings } from '../quality';
import { groundUniforms, NO_LITTER } from '../scene/groundUniforms';
import type { WorldFields } from '../terrain/fields';
import { placementFields } from '../terrain/placementFields';
import { GroundCover } from './ground/GroundCover';
import { InstancedSpecies, type PlantMaterials } from './InstancedSpecies';
import { litterMap } from './litter';
import { buildVegMasks, type VegMasks } from './masks';
import { Occupancy, placeAll } from './placement';
import { KeyedCache, placementKey } from './placementCache';
import { reseat } from './reseat';
import { GROUND_ORDER, PLACEMENT_ORDER } from './rules';
import { makeSpeciesMaterials, SPECIES } from './species';
import { vegTiming } from './stats';
import type { GroundId, PlantInstance, PlantPart, WoodyId } from './types';

const G = geo as unknown as GeoBundle;
const NEAR_SEED = 1840, FAR_SEED = 1841;
/** The distant ring (cards) starts this far inside the near field's edge and is half as dense. */
const FAR_OVERLAP = 40, FAR_DENSITY = 0.5, FAR_OCC_CELL = 4;

interface SpeciesAssets { variants: PlantPart[][]; materials: PlantMaterials }
/** Geometry (3 variants), painted foliage texture and materials per species: built once, kept for the app's life. */
const assets = new Map<WoodyId, SpeciesAssets>();
function speciesAssets(id: WoodyId): SpeciesAssets {
  let a = assets.get(id);
  if (!a) {
    a = { variants: [1, 2, 3].map((s) => SPECIES[id].build(s)), materials: makeSpeciesMaterials(id).materials };
    assets.set(id, a);
  }
  return a;
}

/**
 * Placement sets for every (densities, bank offset, tier) seen this session (8 eras × 3 tiers at
 * most), with the placement fields they ran on and the near trunk discs (ground cover avoids them).
 */
interface Placed { sets: Record<WoodyId, PlantInstance[]>; pf: WorldFields; trunks: Occupancy }
const placements = new KeyedCache<Placed>(24);

const masks = new WeakMap<WorldFields, VegMasks>();
function masksFor(f: WorldFields): VegMasks {
  let m = masks.get(f);
  if (!m) { m = buildVegMasks(G, f); masks.set(f, m); }
  return m;
}

/**
 * All vegetation for the current era and quality tier.
 *  - Near: `placeAll` on the 512 near fields, density = era density × tier density, seed 1840.
 *  - Distant ring (tiers with `farRing`): `placeAll` on the far fields at half that density,
 *    seed 1841, keeping only instances outside the near extent − 40 m.
 * Both sets go to one `InstancedSpecies` per species: its LOD split draws the ring as cards
 * (it lies > 1 km from the landings) and the impostors are baked once per species.
 */
export function Vegetation({ near, far, era, q, bankOffset }: {
  near: WorldFields; far: WorldFields; era: Era; q: QualitySettings; bankOffset: number;
}) {
  const { density, farCards, farRing } = q.veg;
  const dens = useMemo(() => {
    const d = {} as Record<WoodyId, number>;
    for (const id of PLACEMENT_ORDER) d[id] = era.vegetation[id].value * density;
    return d;
  }, [era, density]);
  const tier = `${near.grid.size}|${far.grid.size}|${farCards}|${farRing}`;
  const key = placementKey(dens, bankOffset, tier);
  const { sets, pf, trunks } = useMemo(() => placements.get(key, (): Placed => {
    const t0 = performance.now();
    const pf = placementFields(bankOffset, near);
    const trunks = new Occupancy(pf.grid, 1);
    const nearSet = placeAll(pf, masksFor(pf), dens, NEAR_SEED, { trunks });
    if (pf !== near) for (const id of PLACEMENT_ORDER) nearSet[id] = reseat(nearSet[id], near);

    let farSet: Record<WoodyId, PlantInstance[]> | null = null;
    if (farCards && farRing) {
      const g = near.grid, ext = g.cell * g.size, cx = g.minX + ext / 2, cz = g.minZ + ext / 2, half = ext / 2 - FAR_OVERLAP;
      const farDens = {} as Record<WoodyId, number>;
      for (const id of PLACEMENT_ORDER) farDens[id] = dens[id] * FAR_DENSITY;
      farSet = placeAll(far, masksFor(far), farDens, FAR_SEED,
        { occCell: FAR_OCC_CELL, skip: (x, z) => Math.abs(x - cx) < half && Math.abs(z - cz) < half });
    }
    const out = {} as Record<WoodyId, PlantInstance[]>;
    vegTiming.counts = {};
    for (const id of PLACEMENT_ORDER) {
      out[id] = farSet ? nearSet[id].concat(farSet[id]) : nearSet[id];
      vegTiming.counts[id] = { near: nearSet[id].length, far: farSet?.[id].length ?? 0 };
    }
    vegTiming.placeRuns.push(Math.round(performance.now() - t0));
    return { sets: out, pf, trunks };
  }), [key, near, far]);

  const groundDens = useMemo(() => {
    const d = {} as Record<GroundId, number>;
    for (const id of GROUND_ORDER) d[id] = era.vegetation[id].value * density;
    return d;
  }, [era, density]);

  // Needle litter under the near casuarinas, for the terrain material.
  useEffect(() => {
    const g = near.grid, ext = g.cell * g.size, size = 256;
    const tex = new THREE.DataTexture(litterMap(sets.casuarina, g, size), size, size, THREE.RedFormat, THREE.UnsignedByteType);
    tex.magFilter = THREE.LinearFilter; tex.minFilter = THREE.LinearFilter;
    tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping;
    tex.needsUpdate = true;
    groundUniforms.uLitter.value = tex;
    groundUniforms.uLitterRect.value.set(g.minX, g.minZ, ext, 0);
    return () => {
      if (groundUniforms.uLitter.value === tex) groundUniforms.uLitter.value = NO_LITTER;
      tex.dispose();
    };
  }, [sets, near]);

  return <>
    {PLACEMENT_ORDER.map((id) => {
      const a = speciesAssets(id);
      return <InstancedSpecies key={id} name={id} variants={a.variants} materials={a.materials} instances={sets[id]}
        lod0={q.veg.lod0} reflLod0={q.veg.reflLod0} castShadow={q.shadowMap > 0} farCards={farCards} />;
    })}
    <GroundCover fields={pf} near={near} masks={masksFor(pf)} densities={groundDens} trunks={trunks} radius={q.veg.groundRadius} />
  </>;
}
