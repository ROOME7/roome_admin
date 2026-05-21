// i18n configuration — shared by server and client, so it must stay free
// of any 'server-only' / 'use client' imports.
//
// The panel is bilingual: Italian (default) and English. Locale is held in
// a plain cookie — no URL routing — so a language switch is a cookie write
// plus a router.refresh(), nothing more.

export const locales = ['it', 'en'] as const;
export type Locale = (typeof locales)[number];

export const defaultLocale: Locale = 'it';

export const LOCALE_COOKIE = 'roome_admin_locale';

/** Display names for the language switcher. */
export const localeNames: Record<Locale, string> = {
  it: 'Italiano',
  en: 'English',
};

export function isLocale(value: unknown): value is Locale {
  return value === 'it' || value === 'en';
}
