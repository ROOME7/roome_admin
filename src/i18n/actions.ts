'use server';

// Server Action behind the language switcher: persists the chosen locale
// to a year-long cookie. The client follows up with router.refresh() so
// the whole tree re-renders in the new language.

import { cookies } from 'next/headers';
import { LOCALE_COOKIE, isLocale } from './config';

const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365;

export async function setLocale(locale: string): Promise<void> {
  if (!isLocale(locale)) return;
  (await cookies()).set(LOCALE_COOKIE, locale, {
    path: '/',
    maxAge: ONE_YEAR_SECONDS,
    sameSite: 'lax',
  });
}
