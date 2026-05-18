'use client';

// Listings tab on the Operate page. Lists the partner's listings and
// lets the admin edit the whitelisted mutable fields on each.

import { useState, useTransition } from 'react';
import { deleteListingAs, updateListingAs, type ListingPatch } from '../actions';
import type { OperateListingSummary } from '../actions';
import { Field, InputStyles, Overlay } from '../../../_components/dialog-primitives';
import { CreateListingButton } from './create-listing-dialog';
import { UploadPhotosButton } from './upload-photos-dialog';

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
  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <CreateListingButton uid={uid} disabled={disabled} />
      </div>
      {listings.length === 0 ? (
        <section className="rounded-lg border border-dashed border-border bg-surface p-10 text-center">
          <p className="text-sm text-muted-foreground">
            This partner has no listings yet. Click <strong>Create listing as partner</strong>{' '}
            above to publish one on their behalf.
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
            {listing.description || '(no description)'}
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
            Edit as partner
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
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        disabled={disabled}
        className="rounded-md border border-destructive/40 bg-destructive/5 px-2.5 py-1 text-xs font-medium text-destructive transition-colors hover:bg-destructive/10 disabled:cursor-not-allowed disabled:opacity-50"
      >
        Delete
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
          Remove listing from marketplace?
        </h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Sets the listing to{' '}
          <code className="rounded bg-muted px-1 py-0.5 text-xs">archived</code>{' '}
          and flips the underlying property&apos;s{' '}
          <code className="rounded bg-muted px-1 py-0.5 text-xs">isOnMarket</code>{' '}
          to false. The listing disappears from search but the property + rooms
          stay on file — reversible by editing the property if needed.
        </p>

        <div className="mt-5">
          <Field label="Reason" hint="Optional, audit log">
            <textarea
              rows={3}
              maxLength={1000}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              disabled={pending}
              className="input"
              placeholder="Why are you removing this listing?"
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
            Cancel
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={pending}
            className="rounded-md bg-destructive px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-destructive/90 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {pending ? 'Removing…' : 'Remove from marketplace'}
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
        <h2 className="text-lg font-semibold text-foreground">Edit listing as partner</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Edits the partner&apos;s listing. Audit stamps record you as the operator;
          ownership remains with the partner.
        </p>

        <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Field label="Description" hint={`${description.length} / 5000`}>
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

          <Field label="In-App Rent Payment">
            <label className="mt-1 inline-flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={inAppRentPaymentEnabled}
                onChange={(e) => setInAppRentPaymentEnabled(e.target.checked)}
                disabled={pending}
              />
              Enabled
            </label>
          </Field>

          <Field label="Rent due day of month" hint="1–28 (or blank)">
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

          <Field label="Availability date" hint="Blank = right away">
            <input
              type="date"
              value={availabilityDate}
              onChange={(e) => setAvailabilityDate(e.target.value)}
              disabled={pending}
              className="input"
            />
          </Field>

          <Field label="Preferred stay (months)">
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

          <Field label="Ideal tenant — age range">
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

          <Field label="Gender preference">
            <select
              value={genderPref}
              onChange={(e) => setGenderPref(e.target.value)}
              disabled={pending}
              className="input"
            >
              <option value="any">Any</option>
              <option value="male">Male</option>
              <option value="female">Female</option>
            </select>
          </Field>

          <Field label="Occupation preference">
            <select
              value={occupationPref}
              onChange={(e) => setOccupationPref(e.target.value)}
              disabled={pending}
              className="input"
            >
              <option value="any">Any</option>
              <option value="student">Student</option>
              <option value="worker">Worker</option>
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
            Cancel
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={pending}
            className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-roome-blue-dark disabled:cursor-not-allowed disabled:opacity-60"
          >
            {pending ? 'Saving…' : 'Save changes'}
          </button>
        </div>

        <InputStyles />
      </div>
    </Overlay>
  );
}
