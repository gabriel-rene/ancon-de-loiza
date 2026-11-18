import signUrl from '../../docs/assets/el-ancon-de-loiza-sign.svg';

/** SVG view of the cream panel alone: the green side panels belong to the neighbouring signs on the roof. */
export const SIGN_PANEL = '#svgView(viewBox(35,29,856,142))';

/** The page's h1: the station sign (the owner's vector, the same file the scene paints on the bar roof). */
export function Brand() {
  return <h1 className="brand"><img src={`${signUrl}${SIGN_PANEL}`} alt="El Ancón de Loíza" width={856} height={142} /></h1>;
}
