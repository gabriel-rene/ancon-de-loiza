import { useFrame } from '@react-three/fiber';
import { useEffect, useRef } from 'react';
import { dismissLoadCard, setLoadStep } from '../ui/loadCard';

declare global { interface Window { __ANCON_READY__?: boolean } }

/** body[data-ready] fills the load bar at frame 30; window.__ANCON_READY__ waits until the load card is gone, so shots never catch it mid-fade (spec 7a §4). */
export function ReadySignal() {
  const frames = useRef(0);
  useEffect(() => setLoadStep('scene'), []);
  useFrame(() => {
    if (++frames.current === 30) { document.body.dataset.ready = '1'; dismissLoadCard(undefined, () => { window.__ANCON_READY__ = true; }); }
  });
  return null;
}
