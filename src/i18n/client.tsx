'use client';

// Client-side i18n. The protected layout (a Server Component) resolves the
// locale + dictionary and hands them to <LocaleProvider>; any Client
// Component beneath it then calls useT() / useLocale().

import { createContext, useContext, useMemo } from 'react';
import type { Locale } from './config';
import type { Dictionary } from './dictionaries';
import { createT, type TFunc } from './t';

interface LocaleContextValue {
  locale: Locale;
  t: TFunc;
}

const LocaleContext = createContext<LocaleContextValue | null>(null);

export function LocaleProvider({
  locale,
  dictionary,
  children,
}: {
  locale: Locale;
  dictionary: Dictionary;
  children: React.ReactNode;
}) {
  const value = useMemo<LocaleContextValue>(
    () => ({ locale, t: createT(dictionary) }),
    [locale, dictionary]
  );
  return (
    <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>
  );
}

function useLocaleContext(): LocaleContextValue {
  const ctx = useContext(LocaleContext);
  if (!ctx) {
    throw new Error('useT / useLocale must be used within a LocaleProvider');
  }
  return ctx;
}

export function useT(): TFunc {
  return useLocaleContext().t;
}

export function useLocale(): Locale {
  return useLocaleContext().locale;
}
