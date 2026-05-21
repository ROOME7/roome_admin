// Server-side i18n entry point. Use from Server Components, layouts, and
// route handlers. Reads the locale cookie and returns either the resolved
// locale or a ready-to-use `t` function.

import 'server-only';
import { cookies } from 'next/headers';
import { LOCALE_COOKIE, defaultLocale, isLocale, type Locale } from './config';
import { buildDictionary } from './dictionaries';
import { createT, type TFunc } from './t';

export async function getLocale(): Promise<Locale> {
  const value = (await cookies()).get(LOCALE_COOKIE)?.value;
  return isLocale(value) ? value : defaultLocale;
}

/**
 * Translation function for the current request's locale.
 * In a Server Component tree, pass the returned `t` down to non-async
 * sub-components as a prop (typed `TFunc`).
 */
export async function getT(): Promise<TFunc> {
  const locale = await getLocale();
  return createT(buildDictionary(locale));
}
