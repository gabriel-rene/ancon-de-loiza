export type Lang = 'es' | 'en';
export const LANGS: Lang[] = ['es', 'en'];
/** Every visible string carries both languages (spec 3b §3.1). */
export type Bilingual = { es: string; en: string };

/** First visit without ?lang: English for English browsers, Spanish for everyone else. */
export function detectLang(navLang: string | undefined): Lang {
  return navLang?.toLowerCase().startsWith('en') ? 'en' : 'es';
}

/** New search string with ?lang set; other params survive. */
export function withLang(search: string, lang: Lang): string {
  const p = new URLSearchParams(search);
  p.set('lang', lang);
  return `?${p.toString()}`;
}
