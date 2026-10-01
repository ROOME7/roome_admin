// The protected chrome — sidebar, header, locale — shared by both admin
// layouts.
//
// WHY THERE ARE TWO LAYOUTS. Every screen in the panel is a form or a short
// list and reads better in a centred column, so the shell constrains its
// content to `max-w-6xl`. One screen is not like that: /listings is a dense
// table of every property on the platform, and a centred 1152px column leaves
// most of a wide monitor empty while the table it is holding scrolls
// sideways. So `contained` is a prop rather than a constant, and the table
// screen opts out.
//
// Server Component: it does the authoritative session-cookie verification and
// admin-role check before rendering anything.

import type { ReactNode } from 'react';
import { requireAdminSession } from '@/lib/auth';
import Sidebar from '@/components/sidebar';
import LanguageSwitcher from '@/components/language-switcher';
import { LocaleProvider } from '@/i18n/client';
import { getLocale } from '@/i18n/server';
import { buildDictionary } from '@/i18n/dictionaries';

export default async function AdminShell({
  children,
  contained = false,
}: {
  children: ReactNode;
  /** Centre the content in a reading-width column. Off for full-bleed tables. */
  contained?: boolean;
}) {
  const session = await requireAdminSession();
  const locale = await getLocale();

  return (
    <LocaleProvider locale={locale} dictionary={buildDictionary(locale)}>
      <div className="min-h-screen bg-secondary">
        <Sidebar user={{ email: session.email, uid: session.uid }} />
        <main className="ml-64">
          <header className="sticky top-0 z-20 flex h-14 items-center justify-end border-b border-border bg-surface/80 px-8 backdrop-blur">
            <LanguageSwitcher />
          </header>
          <div className={contained ? 'mx-auto max-w-6xl px-8 py-10' : ''}>{children}</div>
        </main>
      </div>
    </LocaleProvider>
  );
}
