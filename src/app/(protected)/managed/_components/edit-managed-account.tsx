'use client';

// "Edit" button on each active managed-account row. Opens a dialog with
// the partner-facing fields prefilled; email is read-only in v1 (changing
// it requires Auth update + re-verification UX we don't have).

import { useState, useTransition } from 'react';
import { updateManagedAccountProfile } from '../actions';
import type { ManagedAccount } from '../_lib/types';
import { Field, InputStyles, Overlay } from './dialog-primitives';
import { useT } from '@/i18n/client';

interface Props {
  account: ManagedAccount;
}

export function EditManagedAccountButton({ account }: Props) {
  const t = useT();
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-md border border-border bg-surface px-3 py-1.5 text-sm font-medium text-foreground transition-colors hover:bg-secondary"
      >
        {t('managed.editButton')}
      </button>

      {open && <EditDialog account={account} onClose={() => setOpen(false)} />}
    </>
  );
}

function EditDialog({ account, onClose }: { account: ManagedAccount; onClose: () => void }) {
  const t = useT();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const isB2b = account.ownerType === 'owner_b2b';

  function handleSubmit(formData: FormData) {
    setError(null);
    startTransition(async () => {
      const result = await updateManagedAccountProfile(account.uid, formData);
      if (result.ok) {
        onClose();
      } else {
        setError(result.error);
      }
    });
  }

  return (
    <Overlay onClose={pending ? () => {} : onClose}>
      <form
        action={handleSubmit}
        className="w-full max-w-lg rounded-xl border border-border bg-surface p-6 shadow-xl"
      >
        <h2 className="text-lg font-semibold text-foreground">{t('managed.editDialogTitle')}</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          {t('managed.editDialogSubtitle')}
        </p>

        <div className="mt-5 space-y-4">
          <Field label={t('managed.fieldEmail')} hint={t('managed.editEmailHint')}>
            <input
              type="email"
              value={account.email}
              disabled
              readOnly
              className="input"
            />
          </Field>

          <Field label={t('managed.fieldDisplayNameLabel')} required>
            <input
              name="displayUsername"
              type="text"
              required
              minLength={2}
              defaultValue={account.displayUsername}
              disabled={pending}
              className="input"
            />
          </Field>

          {!isB2b ? (
            <Field label={t('managed.fieldFullName')} required>
              <input
                name="fullName"
                type="text"
                required
                minLength={2}
                defaultValue={account.fullName ?? ''}
                disabled={pending}
                className="input"
              />
            </Field>
          ) : (
            <>
              <Field label={t('managed.fieldCompanyName')} required>
                <input
                  name="companyName"
                  type="text"
                  required
                  minLength={2}
                  defaultValue={account.companyName ?? ''}
                  disabled={pending}
                  className="input"
                />
              </Field>
              <Field label={t('managed.fieldVatNumber')} required hint={t('managed.fieldVatHint')}>
                <input
                  name="vatNumber"
                  type="text"
                  required
                  pattern="[0-9]{11}"
                  maxLength={11}
                  inputMode="numeric"
                  defaultValue={account.vatNumber ?? ''}
                  disabled={pending}
                  className="input font-mono"
                />
              </Field>
              <Field label={t('managed.fieldPec')} hint={t('managed.fieldPecHint')}>
                <input
                  name="pec"
                  type="email"
                  defaultValue={account.pec ?? ''}
                  disabled={pending}
                  className="input"
                />
              </Field>
            </>
          )}

          <Field label={t('managed.fieldPhoneNumber')} hint={t('managed.fieldPhoneHint')}>
            <input
              name="phoneNumber"
              type="tel"
              defaultValue={account.phoneNumber ?? ''}
              disabled={pending}
              className="input"
              placeholder={t('managed.fieldPhonePlaceholder')}
            />
          </Field>

          <Field label={t('managed.fieldInternalNote')} hint={t('managed.fieldInternalNoteHint')}>
            <textarea
              name="notes"
              rows={3}
              maxLength={2000}
              defaultValue={account.adminNotes ?? ''}
              disabled={pending}
              className="input"
            />
          </Field>
        </div>

        {error && (
          <p
            role="alert"
            className="mt-4 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive"
          >
            {error}
          </p>
        )}

        <div className="mt-6 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={pending}
            className="rounded-md border border-border bg-surface px-3 py-1.5 text-sm font-medium text-foreground transition-colors hover:bg-secondary disabled:cursor-not-allowed disabled:opacity-60"
          >
            {t('common.cancel')}
          </button>
          <button
            type="submit"
            disabled={pending}
            className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-roome-blue-dark disabled:cursor-not-allowed disabled:opacity-60"
          >
            {pending ? t('managed.editSaving') : t('managed.editSaveChanges')}
          </button>
        </div>

        <InputStyles />
      </form>
    </Overlay>
  );
}
