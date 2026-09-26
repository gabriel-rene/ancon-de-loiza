import { useFrame } from '@react-three/fiber';
import { useRef } from 'react';

declare global { interface Window { __ANCON_READY__?: boolean } }

export function ReadySignal() {
  const frames = useRef(0);
  useFrame(() => {
    if (++frames.current === 30) { window.__ANCON_READY__ = true; document.body.dataset.ready = '1'; }
  });
  return null;
}
