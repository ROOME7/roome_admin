// Wraps every protected page. Server Component (Node runtime) — does the
// authoritative session-cookie verification + admin-role check, then renders
// the sidebar layout with the page's children.
//
// Per docs/architecture/admin-panel.md §8.4, middleware did the cheap
// presence check; this layout is where the cookie is actually decoded and
// the admin claim confirmed.
//
// It also resolves the locale once and seeds <LocaleProvider> so every
// Client Component beneath can translate via useT().

import type { ReactNode } from 'react';
import { requireAdminSession } from '@/lib/auth';
import Sidebar from '@/components/sidebar';
import LanguageSwitcher from '@/components/language-switcher';
import { LocaleProvider } from '@/i18n/client';
import { getLocale } from '@/i18n/server';
import { buildDictionary } from '@/i18n/dictionaries';

export default async function ProtectedLayout({
  children,
}: {
  children: ReactNode;
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
          <div className="mx-auto max-w-6xl px-8 py-10">{children}</div>
        </main>
      </div>
    </LocaleProvider>
  );
}
