'use client';

// "Create new managed account" — header button + dialog with the create form.
// On success, the Server Action revalidates /managed so the new row appears
// automatically. We close the dialog and surface a brief success message.

import { useState, useTransition, type ReactNode } from 'react';
import type { OwnerType } from '../_lib/types';
import { createManagedAccount } from '../actions';
import { useT } from '@/i18n/client';

export function CreateManagedAccountButton() {
  const t = useT();
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-roome-blue-dark"
      >
        <PlusIcon />
        {t('managed.createButton')}
      </button>

      {open && <CreateDialog onClose={() => setOpen(false)} />}
    </>
  );
}

function PlusIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-4 w-4"
      aria-hidden="true"
    >
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  );
}

function CreateDialog({ onClose }: { onClose: () => void }) {
  const t = useT();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [ownerType, setOwnerType] = useState<OwnerType>('owner_b2c');
  const isB2b = ownerType === 'owner_b2b';

  function handleSubmit(formData: FormData) {
    setError(null);
    startTransition(async () => {
      const result = await createManagedAccount(formData);
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
        <h2 className="text-lg font-semibold text-foreground">
          {t('managed.createDialogTitle')}
        </h2>
        <p className="mt-2 text-sm text-muted-foreground">
          {t('managed.createDialogSubtitle')}
        </p>

        <div className="mt-5 space-y-4">
          <Field label={t('managed.fieldEmail')} required>
            <input
              name="email"
              type="email"
              required
              disabled={pending}
              autoComplete="off"
              className="input"
              placeholder={t('managed.fieldEmailPlaceholder')}
            />
          </Field>

          <Field label={t('managed.fieldDisplayNameLabel')} required>
            <input
              name="displayUsername"
              type="text"
              required
              minLength={2}
              disabled={pending}
              className="input"
              placeholder={t('managed.fieldDisplayNamePlaceholder')}
            />
          </Field>

          <Field label={t('managed.fieldOwnerType')} required>
            <div className="mt-1 flex gap-3">
              <label className="flex flex-1 cursor-pointer items-center gap-2 rounded-md border border-input bg-surface px-3 py-2 text-sm text-foreground has-[:checked]:border-primary has-[:checked]:bg-primary/5">
                <input
                  type="radio"
                  name="ownerType"
                  value="owner_b2c"
                  checked={ownerType === 'owner_b2c'}
                  onChange={() => setOwnerType('owner_b2c')}
                  disabled={pending}
                  className="text-primary focus:ring-ring/30"
                />
                {t('managed.ownerTypePrivateRadio')}
              </label>
              <label className="flex flex-1 cursor-pointer items-center gap-2 rounded-md border border-input bg-surface px-3 py-2 text-sm text-foreground has-[:checked]:border-primary has-[:checked]:bg-primary/5">
                <input
                  type="radio"
                  name="ownerType"
                  value="owner_b2b"
                  checked={ownerType === 'owner_b2b'}
                  onChange={() => setOwnerType('owner_b2b')}
                  disabled={pending}
                  className="text-primary focus:ring-ring/30"
                />
                {t('managed.ownerTypeInstitutionalRadio')}
              </label>
            </div>
          </Field>

          {!isB2b ? (
            <Field label={t('managed.fieldFullName')} required>
              <input
                name="fullName"
                type="text"
                required
                minLength={2}
                disabled={pending}
                className="input"
                placeholder={t('managed.fieldFullNamePlaceholder')}
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
                  disabled={pending}
                  className="input font-mono"
                  placeholder="01234567890"
                />
              </Field>
              <Field label={t('managed.fieldPec')} hint={t('managed.fieldPecHint')}>
                <input
                  name="pec"
                  type="email"
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
            {pending ? t('managed.createSubmitting') : t('managed.createSubmit')}
          </button>
        </div>

        <style jsx>{`
          .input {
            margin-top: 0.375rem;
            display: block;
            width: 100%;
            border-radius: 0.375rem;
            border-width: 1px;
            border-color: hsl(var(--input));
            background-color: hsl(var(--surface));
            padding: 0.5rem 0.75rem;
            font-size: 0.875rem;
            color: hsl(var(--foreground));
            box-shadow: 0 1px 2px 0 rgb(0 0 0 / 0.05);
          }
          .input::placeholder {
            color: hsl(var(--muted-foreground));
          }
          .input:focus {
            outline: none;
            border-color: hsl(var(--ring));
            box-shadow: 0 0 0 2px hsl(var(--ring) / 0.3);
          }
          .input:disabled {
            opacity: 0.6;
            cursor: not-allowed;
          }
        `}</style>
      </form>
    </Overlay>
  );
}

function Field({
  label,
  required = false,
  hint,
  children,
}: {
  label: string;
  required?: boolean;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <label className="block">
      <span className="flex items-baseline justify-between gap-3 text-sm font-medium text-foreground">
        <span>
          {label}
          {required && <span className="ml-0.5 text-destructive">*</span>}
        </span>
        {hint && <span className="text-xs font-normal text-muted-foreground">{hint}</span>}
      </span>
      {children}
    </label>
  );
}

function Overlay({
  onClose,
  children,
}: {
  onClose: () => void;
  children: ReactNode;
}) {
  return (
    <div
      role="presentation"
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-foreground/40 p-4 backdrop-blur-sm"
    >
      <div
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
        className="contents"
      >
        {children}
      </div>
    </div>
  );
}
