import { QUALITY } from '../quality';
import { useEra, useStore } from '../state/store';
import { Backdrop } from './Backdrop';
import { Post } from './post/Post';
import { SkyAndLight } from './SkyAndLight';
import { Terrain } from './Terrain';
import { useSun } from './useSun';
import { useWorldFields } from './useWorldFields';
import { Water } from './water/Water';
import { Vegetation } from '../vegetation/Vegetation';

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
      <Vegetation near={near} far={far} era={era} q={q} bankOffset={era.river.bankOffset.value} />
      <Water near={near} far={far} sun={sun} flow={era.river.flow.value} reflScale={q.reflScale} frozen={frozen} />
      <Post sun={sun} ao={q.ao} />
    </>
  );
}
