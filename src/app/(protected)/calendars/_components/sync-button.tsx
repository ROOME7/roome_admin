'use client';

import { useState, useTransition } from 'react';
import { useT } from '@/i18n/client';
import { syncCalendars, type SyncResult } from '../actions';

export function SyncButton() {
  const t = useT();
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<SyncResult | null>(null);

  return (
    <div className="text-right">
      <button
        type="button"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            setResult(await syncCalendars());
          })
        }
        className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-roome-blue-dark disabled:cursor-not-allowed disabled:opacity-60"
      >
        {pending ? t('calendars.syncing') : t('calendars.syncNow')}
      </button>
      {result && (
        <p
          className={`mt-2 text-xs ${result.ok ? 'text-muted-foreground' : 'text-destructive'}`}
          role="status"
        >
          {result.ok
            ? t('calendars.synced', {
                synced: result.synced ?? 0,
                unchanged: result.unchanged ?? 0,
                failed: result.failed ?? 0,
              })
            : result.error}
        </p>
      )}
    </div>
  );
}
