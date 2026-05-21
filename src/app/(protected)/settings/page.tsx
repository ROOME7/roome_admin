// /settings — admin account settings (placeholder).
// Future: change password, enroll MFA, review your own role change history.

import { getT } from '@/i18n/server';

export default async function SettingsPage() {
  const t = await getT();

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          {t('settings.title')}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {t('settings.subtitle')}
        </p>
      </header>

      <section className="rounded-lg border border-dashed border-border bg-surface p-10 text-center">
        <p className="text-sm text-muted-foreground">
          {t('settings.comingSoon')}
        </p>
      </section>
    </div>
  );
}
