'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { useT } from '@/i18n/client';
import { commitImport, discardImport } from '../actions';

/**
 * The two decisions.
 *
 * ⚠️ COMMITTING ASKS FIRST. It writes a partner's whole portfolio in one go
 * and the undo is manual, so a mis-click on a page somebody is scrolling
 * through should not be enough.
 */
export function DecideButtons({ id }: { id: string }) {
  const t = useT();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function run(action: 'commit' | 'discard') {
    setError(null);
    startTransition(async () => {
      const result = action === 'commit' ? await commitImport(id) : await discardImport(id);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setConfirming(false);
      router.refresh();
    });
  }

  return (
    <div className="text-right">
      <div className="flex flex-wrap items-center justify-end gap-2">
        <button
          type="button"
          disabled={pending}
          onClick={() => run('discard')}
          className="rounded-md border border-border bg-surface px-3 py-2 text-sm font-medium text-foreground transition-colors hover:bg-secondary disabled:opacity-60"
        >
          {pending ? t('partnerImports.discarding') : t('partnerImports.discard')}
        </button>

        {confirming ? (
          <>
            <button
              type="button"
              disabled={pending}
              onClick={() => run('commit')}
              className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-roome-blue-dark disabled:opacity-60"
            >
              {pending ? t('partnerImports.committing') : t('common.confirm')}
            </button>
            <button
              type="button"
              disabled={pending}
              onClick={() => setConfirming(false)}
              className="rounded-md px-2 py-2 text-sm text-muted-foreground hover:text-foreground"
            >
              {t('common.cancel')}
            </button>
          </>
        ) : (
          <button
            type="button"
            disabled={pending}
            onClick={() => setConfirming(true)}
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-roome-blue-dark disabled:opacity-60"
          >
            {t('partnerImports.commit')}
          </button>
        )}
      </div>
      {error && (
        <p role="alert" className="mt-2 text-xs text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
