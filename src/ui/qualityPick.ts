import { detectQuality, type QualityChoice } from '../quality';
import { saveQualityPref, withoutQ } from '../state/qualityPrefs';
import { useStore } from '../state/store';
import { requestQuality } from './dipController';

/** The quality button's pick (spec 7a §3): saved, replaces ?q, Auto restarts from the start tier. */
export function pickQuality(c: QualityChoice) {
  saveQualityPref(c);
  const { search, pathname, hash } = window.location;
  if (new URLSearchParams(search).has('q')) window.history.replaceState(null, '', pathname + withoutQ(search) + hash);
  const st = useStore.getState();
  st.setQualityMode(c !== 'auto' ? 'hand' : st.frozen || st.perf || st.debug ? 'off' : 'auto');
  requestQuality(c === 'auto' ? detectQuality() : c);
}
