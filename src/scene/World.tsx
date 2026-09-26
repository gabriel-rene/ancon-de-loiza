import { QUALITY } from '../quality';
import { useEra, useStore } from '../state/store';
import { Backdrop } from './Backdrop';
import { Post } from './post/Post';
import { SkyAndLight } from './SkyAndLight';
import { Terrain } from './Terrain';
import { useSun } from './useSun';
import { useWorldFields } from './useWorldFields';
import { Water } from './water/Water';

export function World() {
  const { near, far } = useWorldFields();
  const q = QUALITY[useStore((s) => s.quality)];
  const sun = useSun();
  const era = useEra();
  const frozen = useStore((s) => s.frozen);
  return (
    <>
      <SkyAndLight sun={sun} shadowMap={q.shadowMap} />
      <Backdrop />
      <Terrain near={near} far={far} shadows={q.shadowMap > 0} sun={sun} />
      <Water near={near} far={far} sun={sun} flow={era.river.flow.value} reflScale={q.reflScale} frozen={frozen} />
      <Post sun={sun} ao={q.ao} />
    </>
  );
}
