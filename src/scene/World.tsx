import { QUALITY } from '../quality';
import { useStore } from '../state/store';
import { Terrain } from './Terrain';
import { useWorldFields } from './useWorldFields';

export function World() {
  const { near, far } = useWorldFields();
  const q = QUALITY[useStore((s) => s.quality)];
  return (
    <>
      <ambientLight intensity={0.6} />
      <directionalLight position={[-300, 200, 400]} intensity={2} />
      <Terrain near={near} far={far} shadows={q.shadowMap > 0} />
    </>
  );
}
