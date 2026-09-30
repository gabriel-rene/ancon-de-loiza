// Shared test fixtures for src/fauna (imported by *.test.ts only).
import { fields512 } from '../ancon/testing';
import { vesselSpec } from '../ancon/spec';
import { getEra, type EraId } from '../data/eras';
import { sampleField } from '../terrain/fields';
import { eraTimings } from '../traffic/schedule';
import { faunaSite, type FaunaWorld } from './site';

/** An era's fauna world on the 512 placement fields, with its own dock timings. */
export function worldFor(id: EraId): FaunaWorld {
  const e = getEra(id), f = fields512(e.river.bankOffset.value);
  const spec = vesselSpec(e, eraTimings(e));
  return { site: faunaSite(f, (x, z) => sampleField(f, f.height, x, z)), T: spec.timings, moored: spec.moored };
}
