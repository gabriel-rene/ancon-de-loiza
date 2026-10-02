import { useFrame } from '@react-three/fiber';
import { useEffect, useRef } from 'react';
import { dismissLoadCard, setLoadStep } from '../ui/loadCard';

declare global { interface Window { __ANCON_READY__?: boolean } }

export function ReadySignal() {
  const frames = useRef(0);
  useEffect(() => setLoadStep('scene'), []);
  useFrame(() => {
    if (++frames.current === 30) { window.__ANCON_READY__ = true; document.body.dataset.ready = '1'; dismissLoadCard(); }
  });
  return null;
}
