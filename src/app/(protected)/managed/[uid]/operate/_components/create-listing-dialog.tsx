'use client';

// T3-B: "Create listing as partner" dialog. Mandatory fields only —
// admins can refine via the existing Edit dialog after creation.
// Photos are uploaded separately via the Photos dialog on the listing row.
//
// The form authors a property + its rooms; the listings/{} doc is
// auto-built by the syncListingOnPropertyWrite Cloud Function.

import { useState, useTransition } from 'react';
import {
  publishListingAs,
  type PublishListingInput,
  type RoomInput,
} from '../actions';
import { Field, InputStyles, Overlay } from '../../../_components/dialog-primitives';

interface Props {
  uid: string;
  disabled: boolean;
}

export function CreateListingButton({ uid, disabled }: Props) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        disabled={disabled}
        className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-roome-blue-dark disabled:cursor-not-allowed disabled:opacity-50"
      >
        Create listing as partner
      </button>
      {open && <CreateListingDialog uid={uid} onClose={() => setOpen(false)} />}
    </>
  );
}

interface RoomDraft {
  id: string;
  type: 'single' | 'double' | 'master';
  priceEuros: string; // form input as €
  bedCount: string;
  description: string;
}

function newRoom(): RoomDraft {
  return {
    id: Math.random().toString(36).slice(2),
    type: 'single',
    priceEuros: '',
    bedCount: '1',
    description: '',
  };
}

function CreateListingDialog({ uid, onClose }: { uid: string; onClose: () => void }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  // Address
  const [region, setRegion] = useState('');
  const [province, setProvince] = useState('');
  const [city, setCity] = useState('');
  const [neighborhood, setNeighborhood] = useState('');
  const [street, setStreet] = useState('');
  const [streetNumber, setStreetNumber] = useState('');
  const [postalCode, setPostalCode] = useState('');
  // Facts
  const [propertyType, setPropertyType] = useState<'apartment' | 'house' | 'shared_house'>(
    'apartment'
  );
  const [floor, setFloor] = useState('');
  const [totalBathrooms, setTotalBathrooms] = useState('1');
  const [description, setDescription] = useState('');
  const [inAppRentPaymentEnabled, setInAppRentPaymentEnabled] = useState(false);
  const [rentDueDayOfMonth, setRentDueDayOfMonth] = useState('');
  // Rooms
  const [rooms, setRooms] = useState<RoomDraft[]>([newRoom()]);

  function updateRoom(idx: number, patch: Partial<RoomDraft>) {
    setRooms((rs) => rs.map((r, i) => (i === idx ? { ...r, ...patch } : r)));
  }
  function removeRoom(idx: number) {
    setRooms((rs) => (rs.length <= 1 ? rs : rs.filter((_, i) => i !== idx)));
  }
  function addRoom() {
    if (rooms.length >= 10) return;
    setRooms((rs) => [...rs, newRoom()]);
  }

  function submit() {
    setError(null);

    // Build PublishListingInput from form state, converting types.
    const parsedRooms: RoomInput[] = [];
    for (let i = 0; i < rooms.length; i += 1) {
      const r = rooms[i];
      const priceEur = Number.parseFloat(r.priceEuros);
      const bedCount = Number.parseInt(r.bedCount, 10);
      if (!Number.isFinite(priceEur) || priceEur <= 0) {
        setError(`Room ${i + 1}: price must be > 0.`);
        return;
      }
      if (!Number.isFinite(bedCount) || bedCount < 1 || bedCount > 6) {
        setError(`Room ${i + 1}: bed count must be 1–6.`);
        return;
      }
      parsedRooms.push({
        type: r.type,
        pricePerPersonCents: Math.round(priceEur * 100),
        bedCount,
        description: r.description.trim() || undefined,
      });
    }

    const input: PublishListingInput = {
      street: street.trim(),
      streetNumber: streetNumber.trim(),
      postalCode: postalCode.trim(),
      city: city.trim(),
      province: province.trim(),
      region: region.trim(),
      neighborhood: neighborhood.trim() || undefined,
      propertyType,
      floor: floor === '' ? null : Number.parseInt(floor, 10),
      totalBathrooms: Number.parseInt(totalBathrooms, 10),
      description: description.trim(),
      inAppRentPaymentEnabled,
      rentDueDayOfMonth: inAppRentPaymentEnabled
        ? Number.parseInt(rentDueDayOfMonth, 10)
        : null,
      rooms: parsedRooms,
    };

    startTransition(async () => {
      const result = await publishListingAs(uid, input);
      if (result.ok) {
        onClose();
      } else {
        setError(result.error);
      }
    });
  }

  return (
    <Overlay onClose={pending ? () => {} : onClose}>
      <div className="w-full max-w-3xl rounded-xl border border-border bg-surface p-6 shadow-xl">
        <h2 className="text-lg font-semibold text-foreground">Create listing as partner</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Creates a property + its rooms with{' '}
          <code className="rounded bg-muted px-1 py-0.5 text-xs">isOnMarket=true</code>.
          The listing doc is auto-built. Add photos from the listing row after
          creation.
        </p>

        <fieldset className="mt-5 space-y-4 rounded-md border border-border p-4">
          <legend className="px-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Address
          </legend>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="Region" required>
              <input
                type="text"
                required
                value={region}
                onChange={(e) => setRegion(e.target.value)}
                disabled={pending}
                className="input"
                placeholder="e.g. Lombardia"
              />
            </Field>
            <Field label="Province" required>
              <input
                type="text"
                required
                value={province}
                onChange={(e) => setProvince(e.target.value)}
                disabled={pending}
                className="input"
                placeholder="e.g. Milano"
              />
            </Field>
            <Field label="City" required>
              <input
                type="text"
                required
                value={city}
                onChange={(e) => setCity(e.target.value)}
                disabled={pending}
                className="input"
              />
            </Field>
            <Field label="Neighborhood" hint="Optional">
              <input
                type="text"
                value={neighborhood}
                onChange={(e) => setNeighborhood(e.target.value)}
                disabled={pending}
                className="input"
              />
            </Field>
            <Field label="Street" required>
              <input
                type="text"
                required
                value={street}
                onChange={(e) => setStreet(e.target.value)}
                disabled={pending}
                className="input"
              />
            </Field>
            <Field label="Street number" required>
              <input
                type="text"
                required
                value={streetNumber}
                onChange={(e) => setStreetNumber(e.target.value)}
                disabled={pending}
                className="input"
              />
            </Field>
            <Field label="Postal code" required>
              <input
                type="text"
                required
                value={postalCode}
                onChange={(e) => setPostalCode(e.target.value)}
                disabled={pending}
                className="input"
                placeholder="e.g. 20121"
              />
            </Field>
          </div>
        </fieldset>

        <fieldset className="mt-5 space-y-4 rounded-md border border-border p-4">
          <legend className="px-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Property facts
          </legend>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <Field label="Type" required>
              <select
                value={propertyType}
                onChange={(e) =>
                  setPropertyType(e.target.value as typeof propertyType)
                }
                disabled={pending}
                className="input"
              >
                <option value="apartment">Apartment</option>
                <option value="house">House</option>
                <option value="shared_house">Shared house</option>
              </select>
            </Field>
            <Field label="Floor" hint="Optional">
              <input
                type="number"
                value={floor}
                onChange={(e) => setFloor(e.target.value)}
                disabled={pending}
                className="input"
              />
            </Field>
            <Field label="Bathrooms" required>
              <input
                type="number"
                min={0}
                max={10}
                required
                value={totalBathrooms}
                onChange={(e) => setTotalBathrooms(e.target.value)}
                disabled={pending}
                className="input"
              />
            </Field>
          </div>
          <Field label="Description" required hint={`${description.length} / 5000`}>
            <textarea
              rows={4}
              maxLength={5000}
              required
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              disabled={pending}
              className="input"
            />
          </Field>
        </fieldset>

        <fieldset className="mt-5 space-y-4 rounded-md border border-border p-4">
          <legend className="px-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            In-App Rent Payment
          </legend>
          <label className="inline-flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={inAppRentPaymentEnabled}
              onChange={(e) => setInAppRentPaymentEnabled(e.target.checked)}
              disabled={pending}
            />
            Enable In-App Rent Payment on this listing
          </label>
          {inAppRentPaymentEnabled && (
            <Field label="Rent due day of month" required hint="1–28">
              <input
                type="number"
                min={1}
                max={28}
                required
                value={rentDueDayOfMonth}
                onChange={(e) => setRentDueDayOfMonth(e.target.value)}
                disabled={pending}
                className="input"
              />
            </Field>
          )}
        </fieldset>

        <fieldset className="mt-5 space-y-3 rounded-md border border-border p-4">
          <legend className="px-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Rooms · {rooms.length}
          </legend>
          {rooms.map((r, idx) => (
            <div
              key={r.id}
              className="grid grid-cols-1 gap-3 rounded-md border border-border bg-surface p-3 sm:grid-cols-6"
            >
              <Field label={`Room ${idx + 1} — Type`} required>
                <select
                  value={r.type}
                  onChange={(e) =>
                    updateRoom(idx, {
                      type: e.target.value as RoomDraft['type'],
                    })
                  }
                  disabled={pending}
                  className="input"
                >
                  <option value="single">Single</option>
                  <option value="double">Double</option>
                  <option value="master">Master</option>
                </select>
              </Field>
              <Field label="Price / person (€)" required>
                <input
                  type="number"
                  min={1}
                  step="0.01"
                  required
                  value={r.priceEuros}
                  onChange={(e) => updateRoom(idx, { priceEuros: e.target.value })}
                  disabled={pending}
                  className="input"
                />
              </Field>
              <Field label="Bed count" required hint="1–6">
                <input
                  type="number"
                  min={1}
                  max={6}
                  required
                  value={r.bedCount}
                  onChange={(e) => updateRoom(idx, { bedCount: e.target.value })}
                  disabled={pending}
                  className="input"
                />
              </Field>
              <div className="sm:col-span-2">
                <Field label="Room description" hint="Optional">
                  <input
                    type="text"
                    value={r.description}
                    onChange={(e) => updateRoom(idx, { description: e.target.value })}
                    disabled={pending}
                    className="input"
                  />
                </Field>
              </div>
              <div className="flex items-end">
                <button
                  type="button"
                  onClick={() => removeRoom(idx)}
                  disabled={pending || rooms.length <= 1}
                  className="w-full rounded-md border border-destructive/40 bg-destructive/5 px-2 py-1.5 text-xs font-medium text-destructive transition-colors hover:bg-destructive/10 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Remove
                </button>
              </div>
            </div>
          ))}
          <button
            type="button"
            onClick={addRoom}
            disabled={pending || rooms.length >= 10}
            className="rounded-md border border-dashed border-border bg-surface px-3 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50"
          >
            + Add room
          </button>
        </fieldset>

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
            className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-roome-blue-dark disabled:cursor-not-allowed disabled:opacity-60"
          >
            {pending ? 'Publishing…' : 'Publish listing'}
          </button>
        </div>

        <InputStyles />
      </div>
    </Overlay>
  );
}
