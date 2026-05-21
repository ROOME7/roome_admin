// /login — admin sign-in page.
//
// Server component shell + client island for the form. If the visitor already
// has a valid admin session, we bounce them to / before rendering anything.

import { redirect } from 'next/navigation';
import { readAdminSessionOrNull } from '@/lib/auth';
import { getLocale, getT } from '@/i18n/server';
import { buildDictionary } from '@/i18n/dictionaries';
import { LocaleProvider } from '@/i18n/client';
import LoginForm from './login-form';

type SearchParams = Promise<{ redirect?: string; error?: string }>;

export default async function LoginPage({ searchParams }: { searchParams: SearchParams }) {
  const session = await readAdminSessionOrNull();
  const params = await searchParams;
  if (session) redirect(params.redirect ?? '/');

  const [locale, t] = await Promise.all([getLocale(), getT()]);

  return (
    <LocaleProvider locale={locale} dictionary={buildDictionary(locale)}>
      <main className="flex min-h-screen items-center justify-center bg-secondary px-4">
        <div className="w-full max-w-sm rounded-xl border border-border bg-surface p-8 shadow-sm">
          <header className="mb-6 flex items-start gap-3">
            <span
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-roome-blue text-base font-bold text-primary-foreground shadow-sm"
              aria-hidden="true"
            >
              R
            </span>
            <div>
              <h1 className="text-2xl font-semibold tracking-tight text-foreground">Roome Admin</h1>
              <p className="mt-1 text-sm text-muted-foreground">{t('login.subtitle')}</p>
            </div>
          </header>

          <LoginForm redirectPath={params.redirect ?? '/'} initialError={params.error} />
        </div>
      </main>
    </LocaleProvider>
  );
}
