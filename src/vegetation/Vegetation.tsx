import { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import geo from '../data/geo/loiza.json';
import type { GeoBundle } from '../data/geo/types';
import type { Era } from '../data/eras';
import type { QualitySettings } from '../quality';
import { groundUniforms, NO_COVER, NO_LITTER } from '../scene/groundUniforms';
import { sampleField, type WorldFields } from '../terrain/fields';
import { eraTown, townBlocked } from '../town/town';
import { placementFields } from '../terrain/placementFields';
import { coverMap } from './coverMap';
import { GroundCover } from './ground/GroundCover';
import { InstancedSpecies, type PlantMaterials } from './InstancedSpecies';
import { caneLayout, inCane, shownMask, type CaneLayout } from './landscape/caneFields';
import { CaneFields, caneHeightAt, caneWaterAt } from './landscape/CaneFieldsMesh';
import { trimSteep, trimWet } from './landscape/caneMesh';
import { findBlocks, insideBlocks, plantBlocks } from './landscape/plantation';
import { BRIDGE, bridgeCorridor } from '../infrastructure/bridge';
import { bridgeWay } from '../infrastructure/roads';
import { litterMap } from './litter';
import { buildVegMasks, type VegMasks } from './masks';
import { markTrunks, Occupancy, placeAll, warmHabitat } from './placement';
import { KeyedCache, placementKey } from './placementCache';
import { reseat } from './reseat';
import { GROUND_ORDER, PLACEMENT_ORDER } from './rules';
import { buildPalm } from './species/palm';
import { makeSpeciesMaterials, SPECIES } from './species';
import { vegTiming } from './stats';
import type { GroundId, PlantInstance, PlantPart, WoodyId } from './types';

const G = geo as unknown as GeoBundle;
/** Eras with a bridge keep woody plants off its line (deck half-width + 3 m), so no crown pierces the deck (4a). */
const inBridge = bridgeCorridor(bridgeWay(G), BRIDGE.width / 2 + 3);
const NEAR_SEED = 1840, FAR_SEED = 1841;
/** The distant ring (cards) starts this far inside the near field's edge and is half as dense. */
const FAR_OVERLAP = 40, FAR_DENSITY = 0.5, FAR_OCC_CELL = 4;

interface SpeciesAssets { variants: PlantPart[][]; materials: PlantMaterials }
/** Painted foliage texture and materials per species: built once, kept for the app's life. */
const materials = new Map<WoodyId, PlantMaterials>();
/** Geometry (3 variants) per species and palm age (only coconut depends on age): built once. */
const geometry = new Map<string, PlantPart[][]>();
function speciesAssets(id: WoodyId, palmAge: number): SpeciesAssets {
  let m = materials.get(id);
  if (!m) { m = makeSpeciesMaterials(id).materials; materials.set(id, m); }
  const age = id === 'coconut' ? Math.round(palmAge * 2) / 2 : 1, key = `${id}|${age}`;
  let v = geometry.get(key);
  if (!v) {
    v = [1, 2, 3].map((s) => (id === 'coconut' ? buildPalm(s, age) : SPECIES[id].build(s)));
    geometry.set(key, v);
  }
  return { variants: v, materials: m };
}

/**
 * Placement sets for every (densities, bank offset, tier) seen this session (8 eras × 3 tiers at
 * most), with the placement fields they ran on and how many of each set's instances (the first
 * ones) are near-field. The near trunk discs are not cached (a 1 m grid over the whole map is
 * ~6.5 MB): only the current set's are built, from those near instances.
 */
interface Placed { sets: Record<WoodyId, PlantInstance[]>; pf: WorldFields; nearCount: Record<WoodyId, number> }
const placements = new KeyedCache<Placed>(24);

const masks = new WeakMap<WorldFields, VegMasks>();
function masksFor(f: WorldFields): VegMasks {
  let m = masks.get(f);
  if (!m) { m = buildVegMasks(G, f); masks.set(f, m); }
  return m;
}

/** The cane layout depends only on the geo bundle: built once, on first use. */
let cane: CaneLayout | null = null;
const caneFor = () => (cane ??= caneLayout(G));

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

  // No woody species grows where cane is shown: computed before placement so the near/far runs
  // (and the placement cache key, which must vary with cane share) can both skip it.
  const caneShare = era.landscape.cane.value;
  const caneByShare = useMemo(() => (caneShare > 0 ? shownMask(caneFor(), caneShare) : null), [caneShare]);
  // Drop cells on or near rendered water first (cane cannot stand in the river/ponds, and a wet
  // cell would otherwise drag its field's flat-top mean down), then steep riverbank cells (flat
  // field tops would stand on tall downhill walls there). Both trims read the rendered terrain, so
  // they can differ by a few cells per tier and bank offset — both are already in the placement
  // key (`tier`, `bankOffset`).
  const caneWet = useMemo(() => (caneByShare ? trimWet(caneFor(), caneByShare, caneWaterAt(near, far)) : null), [caneByShare, near, far]);
  const caneShown = useMemo(() => (caneWet ? trimSteep(caneFor(), caneWet, caneHeightAt(near, far)) : null), [caneWet, near, far]);
  const caneSkip = useMemo(() => (caneShown ? inCane(caneFor(), caneShown) : undefined), [caneShown]);
  const bridge = era.infrastructure.bridge.value !== 'none';
  // Phase 4b: no plants inside a shown house, the church or the plaza (the plaza trees are added below).
  const town = useMemo(() => eraTown(bankOffset, era), [bankOffset, era]);
  const inTown = useMemo(() => townBlocked(town), [town]);
  const skip = useMemo(() => (x: number, z: number) => inTown(x, z) || (bridge && inBridge(x, z)) || !!caneSkip?.(x, z), [bridge, caneSkip, inTown]);

  const survival = era.landscape.plantation.value;
  const tier = `${near.grid.size}|${far.grid.size}|${farCards}|${farRing}`;
  const key = placementKey(dens, bankOffset, tier, `p${survival}|c${caneShare}|b${bridge ? 1 : 0}|t${era.town.houseShare.value}-${era.town.concreteShare.value}`);
  const { sets, pf, nearCount } = useMemo(() => placements.get(key, (): Placed => {
    const t0 = performance.now();
    const pf = placementFields(bankOffset, near);
    const blocks = survival > 0 ? findBlocks(pf, masksFor(pf)) : [];
    const planted = blocks.length ? { coconut: plantBlocks(pf, blocks, survival).filter((p) => !inTown(p.x, p.z)), inside: insideBlocks(blocks) } : undefined;
    const nearSet = placeAll(pf, masksFor(pf), dens, NEAR_SEED, { skip, planted });
    for (const t of town.plazaTrees) {
      nearSet[t.species].push({ x: t.x, y: sampleField(pf, pf.height, t.x, t.z), z: t.z, rot: t.rot, scale: t.scale, variant: t.variant });
    }
    // Ground cover places per tile inside the frame loop; build its habitat masks here instead
    // of three 512² passes in its first frame.
    warmHabitat(pf, masksFor(pf), GROUND_ORDER);
    if (pf !== near) for (const id of PLACEMENT_ORDER) nearSet[id] = reseat(nearSet[id], near);

    let farSet: Record<WoodyId, PlantInstance[]> | null = null;
    if (farCards && farRing) {
      const g = near.grid, ext = g.cell * g.size, cx = g.minX + ext / 2, cz = g.minZ + ext / 2, half = ext / 2 - FAR_OVERLAP;
      const farDens = {} as Record<WoodyId, number>;
      for (const id of PLACEMENT_ORDER) farDens[id] = dens[id] * FAR_DENSITY;
      farSet = placeAll(far, masksFor(far), farDens, FAR_SEED, {
        occCell: FAR_OCC_CELL,
        skip: (x, z) => (Math.abs(x - cx) < half && Math.abs(z - cz) < half) || !!skip?.(x, z),
      });
    }
    const out = {} as Record<WoodyId, PlantInstance[]>, nearCount = {} as Record<WoodyId, number>;
    vegTiming.counts = {};
    for (const id of PLACEMENT_ORDER) {
      out[id] = farSet ? nearSet[id].concat(farSet[id]) : nearSet[id];
      nearCount[id] = nearSet[id].length;
      vegTiming.counts[id] = { near: nearSet[id].length, far: farSet?.[id].length ?? 0 };
    }
    vegTiming.placeRuns.push(Math.round(performance.now() - t0));
    return { sets: out, pf, nearCount };
  }), [key, near, far, skip, town, inTown]);

  // Near trunk discs for ground cover (reseat only moves y, so x/z/scale match the placement run).
  const trunks = useMemo(() => {
    const t = new Occupancy(pf.grid, 1);
    for (const id of PLACEMENT_ORDER) markTrunks(t, id, sets[id], nearCount[id]);
    return t;
  }, [pf, sets, nearCount]);

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

  // Far ground-cover tint: matches the near clumps' habitat rule beyond their placement radius.
  useEffect(() => {
    const g = pf.grid, ext = g.cell * g.size, size = 256;
    const data = coverMap(pf, masksFor(pf), groundDens, size, caneSkip);
    const tex = new THREE.DataTexture(data, size, size, THREE.RGBAFormat, THREE.UnsignedByteType);
    tex.magFilter = THREE.LinearFilter; tex.minFilter = THREE.LinearFilter;
    tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping;
    tex.needsUpdate = true;
    groundUniforms.uCover.value = tex;
    groundUniforms.uCoverRect.value.set(g.minX, g.minZ, ext, 0);
    return () => {
      if (groundUniforms.uCover.value === tex) groundUniforms.uCover.value = NO_COVER;
      tex.dispose();
    };
  }, [pf, groundDens, caneSkip]);

  return <>
    {PLACEMENT_ORDER.map((id) => {
      const a = speciesAssets(id, era.landscape.palmAge.value);
      return <InstancedSpecies key={id} name={id} variants={a.variants} materials={a.materials} instances={sets[id]}
        lod0={q.veg.lod0} reflLod0={q.veg.reflLod0} castShadow={q.shadowMap > 0} farCards={farCards}
        shadowHalf={q.shadowHalf} shadowMap={q.shadowMap} />;
    })}
    {caneShown && <CaneFields layout={caneFor()} shown={caneShown} near={near} far={far} castShadow={q.shadowMap > 0} />}
    <GroundCover fields={pf} near={near} masks={masksFor(pf)} densities={groundDens} trunks={trunks} radius={q.veg.groundRadius} skip={caneSkip} />
  </>;
}
