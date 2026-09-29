// Shared test fixtures for src/traffic (imported by *.test.ts only).
import { getEra, type EraId } from '../data/eras';
import { ctxFor, fields512 } from '../ancon/testing';
import { sampleField } from '../terrain/fields';
import { dockEnv } from './env';

export const envFor = (id: EraId) => {
  const e = getEra(id), f = fields512(e.river.bankOffset.value);
  return dockEnv(e, ctxFor(id), (x, z) => sampleField(f, f.height, x, z));
};
