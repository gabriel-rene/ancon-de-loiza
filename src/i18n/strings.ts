import type { Bilingual } from './text';

/** UI labels (spec 3b §3.4). Language names in the switch stay in their own language and live in Toolbar. */
export const STRINGS = {
  chooseEra: { es: 'Escoge una época', en: 'Choose an era' },
  facts: { es: 'Datos', en: 'Facts' },
  close: { es: 'Cerrar', en: 'Close' },
  sources: { es: 'Fuentes', en: 'Sources' },
  inferred: { es: 'Inferido', en: 'Inferred' },
  inferredNote: {
    es: 'Inferido: lo deducimos a partir de las fuentes; ellas no lo dicen directamente.',
    en: 'Inferred: we worked this out from the sources; they do not say it directly.',
  },
  language: { es: 'Idioma', en: 'Language' },
  noWebgl: {
    es: 'Tu navegador no puede mostrar la escena 3D. Los datos de cada época siguen disponibles en «Datos».',
    en: 'Your browser cannot show the 3D scene. The facts for each era are still available under “Facts”.',
  },
  mapData: { es: 'Datos del mapa ©', en: 'Map data ©' },
  osmContributors: { es: 'colaboradores de OpenStreetMap', en: 'OpenStreetMap contributors' },
} satisfies Record<string, Bilingual>;
