'use client';

// Listings tab on the Operate page. Lists the partner's listings and
// lets the admin edit the whitelisted mutable fields on each.

import { useState, useTransition } from 'react';
import { deleteListingAs, updateListingAs, type ListingPatch } from '../actions';
import type { OperateListingSummary } from '../actions';
import { Field, InputStyles, Overlay } from '../../../_components/dialog-primitives';
import { CreateListingButton } from './create-listing-dialog';
import { UploadPhotosButton } from './upload-photos-dialog';
import { useT } from '@/i18n/client';

const statusStyles: Record<string, string> = {
  draft: 'bg-muted text-muted-foreground',
  awaiting_payment: 'bg-amber-500/10 text-amber-700',
  active: 'bg-primary/10 text-primary',
  paused: 'bg-secondary text-foreground',
  archived: 'bg-destructive/10 text-destructive',
};

export function ListingsTab({
  uid,
  listings,
  disabled,
}: {
  uid: string;
  listings: OperateListingSummary[];
  disabled: boolean;
}) {
  const t = useT();
  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <CreateListingButton uid={uid} disabled={disabled} />
      </div>
      {listings.length === 0 ? (
        <section className="rounded-lg border border-dashed border-border bg-surface p-10 text-center">
          <p className="text-sm text-muted-foreground">
            {t('operate.listingsEmptyHint', { button: t('operate.listingsCreateButton') })}
          </p>
        </section>
      ) : (
        <ul className="space-y-3">
          {listings.map((l) => (
            <li key={l.listingId}>
              <ListingRow uid={uid} listing={l} disabled={disabled} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function ListingRow({
  uid,
  listing,
  disabled,
}: {
  uid: string;
  listing: OperateListingSummary;
  disabled: boolean;
}) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const statusClass = statusStyles[listing.status] ?? 'bg-muted text-muted-foreground';
  return (
    <article className="rounded-lg border border-border bg-surface p-4">
      <header className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="truncate text-sm font-semibold text-foreground">
              {listing.region ?? '—'}
              {listing.province && (
                <span className="text-muted-foreground"> · {listing.province}</span>
              )}
            </h3>
            <span
              className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${statusClass}`}
            >
              {listing.status}
            </span>
          </div>
          <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
            {listing.description || t('operate.listingNoDescription')}
          </p>
          <p className="mt-1 font-mono text-[10px] text-muted-foreground">
            {listing.listingId}
          </p>
        </div>
        <div className="flex shrink-0 gap-2">
          <UploadPhotosButton
            uid={uid}
            propertyId={listing.propertyId}
            disabled={disabled}
          />
          <button
            type="button"
            onClick={() => setOpen(true)}
            disabled={disabled}
            className="rounded-md border border-border bg-surface px-2.5 py-1 text-xs font-medium text-foreground transition-colors hover:bg-secondary disabled:cursor-not-allowed disabled:opacity-50"
          >
            {t('operate.listingEditButton')}
          </button>
          {listing.status !== 'archived' && (
            <DeleteListingButton
              uid={uid}
              listing={listing}
              disabled={disabled}
            />
          )}
        </div>
      </header>

      <PhotoStrip photoUrls={listing.photoUrls} />

      {open && (
        <EditListingDialog
          uid={uid}
          listing={listing}
          onClose={() => setOpen(false)}
        />
      )}
    </article>
  );
}

function DeleteListingButton({
  uid,
  listing,
  disabled,
}: {
  uid: string;
  listing: OperateListingSummary;
  disabled: boolean;
}) {
  const t = useT();
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        disabled={disabled}
        className="rounded-md border border-destructive/40 bg-destructive/5 px-2.5 py-1 text-xs font-medium text-destructive transition-colors hover:bg-destructive/10 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {t('common.delete')}
      </button>
      {open && (
        <DeleteListingDialog
          uid={uid}
          listing={listing}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}

function DeleteListingDialog({
  uid,
  listing,
  onClose,
}: {
  uid: string;
  listing: OperateListingSummary;
  onClose: () => void;
}) {
  const t = useT();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [reason, setReason] = useState('');

  function submit() {
    setError(null);
    startTransition(async () => {
      const res = await deleteListingAs(uid, listing.listingId, reason);
      if (res.ok) {
        onClose();
      } else {
        setError(res.error);
      }
    });
  }

  return (
    <Overlay onClose={pending ? () => {} : onClose}>
      <div className="w-full max-w-md rounded-xl border border-destructive/30 bg-surface p-6 shadow-xl">
        <h2 className="text-lg font-semibold text-destructive">
          {t('operate.deleteListingTitle')}
        </h2>
        <p className="mt-2 text-sm text-muted-foreground">
          {t('operate.deleteListingDesc', { statusField: 'archived', marketField: 'isOnMarket' })}
        </p>

        <div className="mt-5">
          <Field label={t('operate.deleteReasonLabel')} hint={t('operate.deleteReasonHint')}>
            <textarea
              rows={3}
              maxLength={1000}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              disabled={pending}
              className="input"
              placeholder={t('operate.deleteReasonPlaceholder')}
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
            type="button"
            onClick={submit}
            disabled={pending}
            className="rounded-md bg-destructive px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-destructive/90 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {pending ? t('operate.deleteRemovingButton') : t('operate.deleteRemoveButton')}
          </button>
        </div>

        <InputStyles />
      </div>
    </Overlay>
  );
}

function dateInputValue(d: Date | null): string {
  if (!d) return '';
  return d.toISOString().slice(0, 10);
}

function EditListingDialog({
  uid,
  listing,
  onClose,
}: {
  uid: string;
  listing: OperateListingSummary;
  onClose: () => void;
}) {
  const t = useT();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [description, setDescription] = useState(listing.description);
  const [inAppRentPaymentEnabled, setInAppRentPaymentEnabled] = useState(
    listing.inAppRentPaymentEnabled
  );
  const [rentDueDay, setRentDueDay] = useState<string>(
    listing.rentDueDayOfMonth?.toString() ?? ''
  );
  const [availabilityDate, setAvailabilityDate] = useState<string>(
    dateInputValue(listing.availabilityDate)
  );
  const [stayMonths, setStayMonths] = useState<string>(
    listing.preferredStayLengthMonths?.toString() ?? ''
  );
  const [ageMin, setAgeMin] = useState<string>(
    listing.idealTenant.ageMin?.toString() ?? ''
  );
  const [ageMax, setAgeMax] = useState<string>(
    listing.idealTenant.ageMax?.toString() ?? ''
  );
  const [genderPref, setGenderPref] = useState(listing.idealTenant.genderPref);
  const [occupationPref, setOccupationPref] = useState(
    listing.idealTenant.occupationPref
  );

  function submit() {
    setError(null);
    const patch: ListingPatch = {
      description,
      inAppRentPaymentEnabled,
      rentDueDayOfMonth: rentDueDay === '' ? null : Number.parseInt(rentDueDay, 10),
      availabilityDate: availabilityDate || null,
      preferredStayLengthMonths:
        stayMonths === '' ? null : Number.parseInt(stayMonths, 10),
      idealTenant: {
        ageMin: ageMin === '' ? null : Number.parseInt(ageMin, 10),
        ageMax: ageMax === '' ? null : Number.parseInt(ageMax, 10),
        genderPref: genderPref as 'male' | 'female' | 'any',
        occupationPref: occupationPref as 'student' | 'worker' | 'any',
      },
    };

    startTransition(async () => {
      const result = await updateListingAs(uid, listing.listingId, patch);
      if (result.ok) {
        onClose();
      } else {
        setError(result.error);
      }
    });
  }

  return (
    <Overlay onClose={pending ? () => {} : onClose}>
      <div className="w-full max-w-2xl rounded-xl border border-border bg-surface p-6 shadow-xl">
        <h2 className="text-lg font-semibold text-foreground">{t('operate.editListingTitle')}</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          {t('operate.editListingDesc')}
        </p>

        <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Field label={t('operate.editDescriptionLabel')} hint={`${description.length} / 5000`}>
              <textarea
                rows={4}
                maxLength={5000}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                disabled={pending}
                className="input"
              />
            </Field>
          </div>

          <Field label={t('operate.editRentPaymentLabel')}>
            <label className="mt-1 inline-flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={inAppRentPaymentEnabled}
                onChange={(e) => setInAppRentPaymentEnabled(e.target.checked)}
                disabled={pending}
              />
              {t('operate.editRentEnabledLabel')}
            </label>
          </Field>

          <Field label={t('operate.editRentDueDayLabel')} hint={t('operate.editRentDueDayHint')}>
            <input
              type="number"
              min={1}
              max={28}
              value={rentDueDay}
              onChange={(e) => setRentDueDay(e.target.value)}
              disabled={pending}
              className="input"
            />
          </Field>

          <Field label={t('operate.editAvailabilityLabel')} hint={t('operate.editAvailabilityHint')}>
            <input
              type="date"
              value={availabilityDate}
              onChange={(e) => setAvailabilityDate(e.target.value)}
              disabled={pending}
              className="input"
            />
          </Field>

          <Field label={t('operate.editStayLengthLabel')}>
            <input
              type="number"
              min={1}
              max={120}
              value={stayMonths}
              onChange={(e) => setStayMonths(e.target.value)}
              disabled={pending}
              className="input"
            />
          </Field>

          <Field label={t('operate.editIdealAgeLabel')}>
            <div className="mt-1 flex gap-2">
              <input
                type="number"
                min={18}
                max={99}
                placeholder="min"
                value={ageMin}
                onChange={(e) => setAgeMin(e.target.value)}
                disabled={pending}
                className="input"
              />
              <input
                type="number"
                min={18}
                max={99}
                placeholder="max"
                value={ageMax}
                onChange={(e) => setAgeMax(e.target.value)}
                disabled={pending}
                className="input"
              />
            </div>
          </Field>

          <Field label={t('operate.editGenderPrefLabel')}>
            <select
              value={genderPref}
              onChange={(e) => setGenderPref(e.target.value)}
              disabled={pending}
              className="input"
            >
              <option value="any">{t('operate.editGenderAny')}</option>
              <option value="male">{t('operate.editGenderMale')}</option>
              <option value="female">{t('operate.editGenderFemale')}</option>
            </select>
          </Field>

          <Field label={t('operate.editOccupationPrefLabel')}>
            <select
              value={occupationPref}
              onChange={(e) => setOccupationPref(e.target.value)}
              disabled={pending}
              className="input"
            >
              <option value="any">{t('operate.editOccupationAny')}</option>
              <option value="student">{t('operate.editOccupationStudent')}</option>
              <option value="worker">{t('operate.editOccupationWorker')}</option>
            </select>
          </Field>
        </div>

        {error && (
          <p role="alert" className="mt-4 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
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
            type="button"
            onClick={submit}
            disabled={pending}
            className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-roome-blue-dark disabled:cursor-not-allowed disabled:opacity-60"
          >
            {pending ? t('operate.editSavingButton') : t('operate.editSaveButton')}
          </button>
        </div>

        <InputStyles />
      </div>
    </Overlay>
  );
}

// Renders the listing's photo strip below the row header. Empty state is a
// muted "no photos yet" hint so the admin can tell uploads succeeded — the
// Photos dialog only showed a "Done" badge, which made successful uploads
// feel invisible (2026-05-19 client feedback #1).
function PhotoStrip({ photoUrls }: { photoUrls: string[] }) {
  const t = useT();
  if (photoUrls.length === 0) {
    return (
      <p className="mt-3 text-xs italic text-muted-foreground">
        {t('operate.listingPhotosEmpty')}
      </p>
    );
  }
  return (
    <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
      {photoUrls.map((url, idx) => (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          key={url}
          src={url}
          alt={t('operate.listingPhotoAlt', { n: String(idx + 1) })}
          className="h-20 w-28 shrink-0 rounded-md border border-border object-cover"
          loading="lazy"
        />
      ))}
    </div>
  );
}
