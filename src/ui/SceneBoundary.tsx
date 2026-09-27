import { Component, type ReactNode } from 'react';
import { STRINGS } from '../i18n/strings';
import { useT } from '../i18n/useT';

/** Keeps the page usable when WebGL is missing or the scene throws (spec 3b §5.5): the UI around it stays. */
export class SceneBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch(error: unknown) { console.warn('3D scene failed:', error); }
  render() { return this.state.failed ? <SceneFallback /> : this.props.children; }
}

function SceneFallback() {
  const t = useT();
  return <div className="scene-fallback" role="status">{t(STRINGS.noWebgl)}</div>;
}
