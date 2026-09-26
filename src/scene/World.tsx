import { QUALITY } from '../quality';
import { useEra, useStore } from '../state/store';
import { Backdrop } from './Backdrop';
import { Post } from './post/Post';
import { SkyAndLight } from './SkyAndLight';
import { Terrain } from './Terrain';
import { useSun } from './useSun';
import { useWorldFields } from './useWorldFields';
import { Water } from './water/Water';
import { InstancedSpecies } from '../vegetation/InstancedSpecies';
import { useTestTrees } from '../vegetation/species/testTree';
import type { WorldFields } from '../terrain/fields';
import type { QualitySettings } from '../quality';

// TEMPORARY (Phase 2a Task 6 pipeline check) — delete in Task 10 along with species/testTree.ts.
function TestTreesTemp({ near, q }: { near: WorldFields; q: QualitySettings }) {
  const { variants, materials, instances } = useTestTrees(near);
  return <InstancedSpecies variants={variants} materials={materials} instances={instances}
    lod0={q.veg.lod0} castShadow={q.shadowMap > 0} farCards={q.veg.farCards} />;
}

export function World() {
  const { near, far } = useWorldFields();
  const q = QUALITY[useStore((s) => s.quality)];
  const sun = useSun();
  const era = useEra();
  const frozen = useStore((s) => s.frozen);
  return (
    <>
      <SkyAndLight sun={sun} shadowMap={q.shadowMap} shadowHalf={q.shadowHalf} />
      <Backdrop />
      <Terrain near={near} far={far} shadows={q.shadowMap > 0} sun={sun} />
      <Water near={near} far={far} sun={sun} flow={era.river.flow.value} reflScale={q.reflScale} frozen={frozen} />
      <TestTreesTemp near={near} q={q} />
      <Post sun={sun} ao={q.ao} />
    </>
  );
}
