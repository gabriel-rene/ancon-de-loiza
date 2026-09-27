import { useStore } from '../state/store';
import type { Bilingual } from './text';

/** Picks the current language from a Bilingual. */
export function useT() {
  const lang = useStore((s) => s.lang);
  return (b: Bilingual) => b[lang];
}
