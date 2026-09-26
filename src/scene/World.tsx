import { QUALITY } from '../quality';
import { useStore } from '../state/store';
import { Backdrop } from './Backdrop';
import { SkyAndLight } from './SkyAndLight';
import { Terrain } from './Terrain';
import { useSun } from './useSun';
import { useWorldFields } from './useWorldFields';

export function World() {
  const { near, far } = useWorldFields();
  const q = QUALITY[useStore((s) => s.quality)];
  const sun = useSun();
  return (
    <>
      <SkyAndLight sun={sun} shadowMap={q.shadowMap} />
      <Backdrop />
      <Terrain near={near} far={far} shadows={q.shadowMap > 0} />
    </>
  );
}
