'use client';

// T3-B: "Create listing as partner" dialog. Mandatory fields only —
// admins can refine via the existing Edit dialog after creation.
// Photos are uploaded separately via the Photos dialog on the listing row.
//
// The form authors a property + its rooms; the listings/{} doc is
// auto-built by the syncListingOnPropertyWrite Cloud Function.

import { useEffect, useRef, useState, useTransition } from 'react';
import {
  publishListingAs,
  type PublishListingInput,
  type RoomInput,
} from '../actions';
import { Field, InputStyles, Overlay } from '../../../_components/dialog-primitives';

// ---------------------------------------------------------------------------
// Nominatim (OpenStreetMap) address autocomplete
//
// Mirrors what the Flutter app's add_house_screen.dart does (single Search
// field that pre-fills street / number / city / region / etc.). Nominatim
// is free with no API key — we only need a polite User-Agent and a debounce
// so we don't get rate-limited.
//
// Country is hard-coded to `it` to match the app's behavior.
// ---------------------------------------------------------------------------

interface NominatimAddress {
  road?: string;
  pedestrian?: string;
  path?: string;
  house_number?: string;
  postcode?: string;
  city?: string;
  town?: string;
  village?: string;
  municipality?: string;
  suburb?: string;
  neighbourhood?: string;
  quarter?: string;
  county?: string;
  state_district?: string;
  state?: string;
}

interface NominatimResult {
  display_name: string;
  lat: string;
  lon: string;
  address?: NominatimAddress;
}

export interface ParsedAddress {
  street: string;
  streetNumber: string;
  postalCode: string;
  city: string;
  province: string;
  region: string;
  neighborhood: string;
  // Geocoded coordinates from the Nominatim result. Persisting these on the
  // property is what makes the tenant-side map render at the right place —
  // without them HouseData.latitude defaults to null and the map section
  // hides entirely (preferable to centring on (0,0)).
  latitude: number | null;
  longitude: number | null;
}

function parseNominatim(r: NominatimResult): ParsedAddress {
  const a = r.address ?? {};
  const lat = Number.parseFloat(r.lat);
  const lon = Number.parseFloat(r.lon);
  return {
    street: a.road || a.pedestrian || a.path || '',
    streetNumber: a.house_number || '',
    postalCode: a.postcode || '',
    city: a.city || a.town || a.village || a.municipality || '',
    province: a.county || a.state_district || '',
    region: a.state || '',
    neighborhood: a.suburb || a.neighbourhood || a.quarter || '',
    latitude: Number.isFinite(lat) ? lat : null,
    longitude: Number.isFinite(lon) ? lon : null,
  };
}

function AddressAutocomplete({
  onPick,
  disabled,
}: {
  onPick: (parsed: ParsedAddress) => void;
  disabled: boolean;
}) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<NominatimResult[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (abortRef.current) abortRef.current.abort();

    if (query.trim().length < 3) {
      setResults([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    debounceRef.current = setTimeout(async () => {
      const controller = new AbortController();
      abortRef.current = controller;
      try {
        const url =
          `https://nominatim.openstreetmap.org/search?` +
          `q=${encodeURIComponent(query)}&format=json&addressdetails=1` +
          `&countrycodes=it&limit=5`;
        const res = await fetch(url, {
          signal: controller.signal,
          headers: {
            // Nominatim policy requires a descriptive UA — admin panel
            // contact info per the public terms.
            'Accept-Language': 'it,en',
          },
        });
        if (!res.ok) {
          setResults([]);
        } else {
          const data = (await res.json()) as NominatimResult[];
          setResults(Array.isArray(data) ? data : []);
        }
      } catch (e) {
        if (!(e instanceof DOMException && e.name === 'AbortError')) {
          console.warn('[AddressAutocomplete] lookup failed', e);
        }
      } finally {
        setLoading(false);
      }
    }, 600);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      if (abortRef.current) abortRef.current.abort();
    };
  }, [query]);

  return (
    <div className="relative">
      <input
        type="text"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => {
          // Delay closing so click events on result items can fire first.
          setTimeout(() => setOpen(false), 150);
        }}
        disabled={disabled}
        className="input"
        placeholder="Start typing the address (e.g. Via Roma 12, Milano)"
      />
      {loading && (
        <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
          Searching…
        </span>
      )}
      {open && results.length > 0 && (
        <ul className="absolute z-10 mt-1 max-h-64 w-full overflow-y-auto rounded-md border border-border bg-surface shadow-lg">
          {results.map((r, i) => (
            <li key={`${r.lat}-${r.lon}-${i}`}>
              <button
                type="button"
                onMouseDown={(e) => {
                  // Use onMouseDown so it fires before the input's onBlur
                  // closes the dropdown.
                  e.preventDefault();
                  onPick(parseNominatim(r));
                  setQuery(r.display_name);
                  setOpen(false);
                }}
                className="block w-full px-3 py-2 text-left text-sm text-foreground hover:bg-secondary"
              >
                {r.display_name}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

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

// Field-of-study options — verbatim copy of `_areaOptions` in the Flutter
// add_house_screen.dart. Kept in the same order so the two forms read
// identically. The compatibility calculator matches on these exact
// strings, so they must NOT be translated or reworded.
const IDEAL_TENANT_AREAS = [
  'Indifferente',
  'Ingegneria e Informatica',
  'Matematica e Scienze',
  'Medicina e Salute',
  'Economia e Diritto',
  'Lettere e Filosofia',
  'Architettura e Design',
  'Scienze Sociali e Psicologia',
  'Arte e Musica',
] as const;

interface RoomDraft {
  id: string;
  type: 'single' | 'double' | 'master';
  priceEuros: string; // form input as €
  bedCount: string;
  status: 'available' | 'occupied';
  description: string;
}

function newRoom(): RoomDraft {
  return {
    id: Math.random().toString(36).slice(2),
    type: 'single',
    priceEuros: '',
    bedCount: '1',
    status: 'available',
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
  // Coordinates from the address autocomplete. Required so the tenant-side
  // map renders at the right place; if the admin types the address manually
  // (without picking from the dropdown) these stay null and the property is
  // written without lat/lon so the map section hides instead of pinning to
  // (0,0) in the Gulf of Guinea.
  const [latitude, setLatitude] = useState<number | null>(null);
  const [longitude, setLongitude] = useState<number | null>(null);
  // Facts
  const [propertyType, setPropertyType] = useState<'apartment' | 'house' | 'shared_house'>(
    'apartment'
  );
  const [floor, setFloor] = useState('');
  const [totalBathrooms, setTotalBathrooms] = useState('1');
  const [description, setDescription] = useState('');
  const [inAppRentPaymentEnabled, setInAppRentPaymentEnabled] = useState(false);
  const [rentDueDayOfMonth, setRentDueDayOfMonth] = useState('');
  // Ideal-tenant profile (Flutter `houseProfile`). Mirrors the dropdowns in
  // add_house_screen.dart so admin-created listings get the same
  // compatibility-scoring inputs as app-created ones. Defaults match the
  // Flutter IdealTenantProfile() constructor defaults.
  const [idealAgeMin, setIdealAgeMin] = useState('18');
  const [idealAgeMax, setIdealAgeMax] = useState('30');
  const [idealGender, setIdealGender] = useState<'indifferente' | 'maschio' | 'femmina'>(
    'indifferente'
  );
  const [idealStatus, setIdealStatus] = useState<'indifferente' | 'studente' | 'lavoratore'>(
    'indifferente'
  );
  const [idealArea, setIdealArea] = useState('Indifferente');
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
        status: r.status,
        description: r.description.trim() || undefined,
      });
    }

    // Ideal-tenant validation: age range must be sane (the Flutter
    // IdealTenantProfile.fromMap swaps them if reversed, but reject here
    // so the admin notices the typo).
    const ageMin = Number.parseInt(idealAgeMin, 10);
    const ageMax = Number.parseInt(idealAgeMax, 10);
    if (
      !Number.isFinite(ageMin) ||
      !Number.isFinite(ageMax) ||
      ageMin < 18 ||
      ageMax > 99 ||
      ageMin > ageMax
    ) {
      setError('Ideal tenant: age range must be 18–99 with min ≤ max.');
      return;
    }

    const input: PublishListingInput = {
      street: street.trim(),
      streetNumber: streetNumber.trim(),
      postalCode: postalCode.trim(),
      city: city.trim(),
      province: province.trim(),
      region: region.trim(),
      neighborhood: neighborhood.trim() || undefined,
      latitude: latitude ?? undefined,
      longitude: longitude ?? undefined,
      propertyType,
      floor: floor === '' ? null : Number.parseInt(floor, 10),
      totalBathrooms: Number.parseInt(totalBathrooms, 10),
      description: description.trim(),
      inAppRentPaymentEnabled,
      rentDueDayOfMonth: inAppRentPaymentEnabled
        ? Number.parseInt(rentDueDayOfMonth, 10)
        : null,
      idealTenant: {
        ageMin,
        ageMax,
        gender: idealGender,
        status: idealStatus,
        // professionalArea only meaningful when the owner wants a
        // student — mirrors the Flutter form, which hides the area
        // dropdown unless status === studente.
        professionalArea: idealStatus === 'studente' ? idealArea : 'Indifferente',
      },
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
      <div className="flex max-h-[90vh] w-full max-w-3xl flex-col overflow-y-auto rounded-xl border border-border bg-surface p-6 shadow-xl">
        <h2 className="text-lg font-semibold text-foreground">Create listing as partner</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Creates a property + its rooms with{' '}
          <code className="rounded bg-muted px-1 py-0.5 text-xs">isOnMarket=true</code>.
          The listing doc is auto-built. Add photos from the listing row after
          creation.
        </p>

        <fieldset className="mt-5 space-y-3 rounded-md border border-border p-4">
          <legend className="px-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Address
          </legend>
          {/* Autocomplete — pre-fills the rest of the address fields. Admin
              can still edit any individual field manually after picking.
              Picking from the dropdown also captures lat/lon, which is what
              makes the tenant-side map render at the right place. */}
          <Field
            label="Search address"
            hint={
              latitude != null && longitude != null
                ? `Map pin set (${latitude.toFixed(4)}, ${longitude.toFixed(4)})`
                : 'Pick a result so the tenant map renders'
            }
          >
            <AddressAutocomplete
              disabled={pending}
              onPick={(p) => {
                setStreet(p.street);
                setStreetNumber(p.streetNumber);
                setPostalCode(p.postalCode);
                setCity(p.city);
                setProvince(p.province);
                setRegion(p.region);
                if (p.neighborhood) setNeighborhood(p.neighborhood);
                setLatitude(p.latitude);
                setLongitude(p.longitude);
              }}
            />
          </Field>
          {/* Row 1: Region | Province */}
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
          </div>
          {/* Row 2: City | Postal code (group cognitively) */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_8rem]">
            <Field label="City" required>
              <input
                type="text"
                required
                value={city}
                onChange={(e) => setCity(e.target.value)}
                disabled={pending}
                className="input"
                placeholder="e.g. Milano"
              />
            </Field>
            <Field label="Postal code" required>
              <input
                type="text"
                required
                value={postalCode}
                onChange={(e) => setPostalCode(e.target.value)}
                disabled={pending}
                className="input font-mono"
                placeholder="20121"
              />
            </Field>
          </div>
          {/* Row 3: Street | Street number */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_8rem]">
            <Field label="Street" required>
              <input
                type="text"
                required
                value={street}
                onChange={(e) => setStreet(e.target.value)}
                disabled={pending}
                className="input"
                placeholder="Via Roma"
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
                placeholder="12"
              />
            </Field>
          </div>
          {/* Row 4: Neighborhood (optional, full width) */}
          <Field label="Neighborhood" hint="Optional">
            <input
              type="text"
              value={neighborhood}
              onChange={(e) => setNeighborhood(e.target.value)}
              disabled={pending}
              className="input"
              placeholder="e.g. Navigli"
            />
          </Field>
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

        <fieldset className="mt-5 space-y-4 rounded-md border border-border p-4">
          <legend className="px-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Ideal tenant
          </legend>
          <p className="text-xs text-muted-foreground">
            Feeds the tenant-side compatibility score. Leave everything on
            &quot;Any&quot; if the partner has no preference.
          </p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="Age min" required>
              <input
                type="number"
                min={18}
                max={99}
                required
                value={idealAgeMin}
                onChange={(e) => setIdealAgeMin(e.target.value)}
                disabled={pending}
                className="input"
              />
            </Field>
            <Field label="Age max" required>
              <input
                type="number"
                min={18}
                max={99}
                required
                value={idealAgeMax}
                onChange={(e) => setIdealAgeMax(e.target.value)}
                disabled={pending}
                className="input"
              />
            </Field>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="Gender preference" required>
              <select
                value={idealGender}
                onChange={(e) =>
                  setIdealGender(e.target.value as typeof idealGender)
                }
                disabled={pending}
                className="input"
              >
                <option value="indifferente">Any</option>
                <option value="maschio">Male</option>
                <option value="femmina">Female</option>
              </select>
            </Field>
            <Field label="Occupation preference" required>
              <select
                value={idealStatus}
                onChange={(e) =>
                  setIdealStatus(e.target.value as typeof idealStatus)
                }
                disabled={pending}
                className="input"
              >
                <option value="indifferente">Any</option>
                <option value="studente">Student</option>
                <option value="lavoratore">Worker</option>
              </select>
            </Field>
          </div>
          {/* Field of study — only relevant for a student preference, same
              as the Flutter add-house form, which hides it otherwise. */}
          {idealStatus === 'studente' && (
            <Field label="Field of study" hint="Used for student compatibility">
              <select
                value={idealArea}
                onChange={(e) => setIdealArea(e.target.value)}
                disabled={pending}
                className="input"
              >
                {IDEAL_TENANT_AREAS.map((area) => (
                  <option key={area} value={area}>
                    {area}
                  </option>
                ))}
              </select>
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
              className="space-y-3 rounded-md border border-border bg-surface p-4"
            >
              {/* Header: Room N label + Remove (only when >1 room) */}
              <header className="flex items-center justify-between gap-3">
                <h4 className="text-sm font-semibold text-foreground">
                  Room {idx + 1}
                </h4>
                {rooms.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeRoom(idx)}
                    disabled={pending}
                    className="rounded-md border border-destructive/40 bg-destructive/5 px-2.5 py-1 text-xs font-medium text-destructive transition-colors hover:bg-destructive/10 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    Remove
                  </button>
                )}
              </header>

              {/* Body row 1: Type | Price | Beds — proportional widths */}
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_1fr_6rem]">
                <Field label="Type" required>
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
                <Field label="Price / person" required>
                  <div className="relative mt-1.5">
                    <span
                      className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-sm text-muted-foreground"
                      aria-hidden
                    >
                      €
                    </span>
                    <input
                      type="number"
                      min={1}
                      step="0.01"
                      required
                      value={r.priceEuros}
                      onChange={(e) =>
                        updateRoom(idx, { priceEuros: e.target.value })
                      }
                      disabled={pending}
                      className="input pl-7"
                      placeholder="150.00"
                    />
                  </div>
                </Field>
                <Field label="Beds" required hint="1–6">
                  <input
                    type="number"
                    min={1}
                    max={6}
                    required
                    value={r.bedCount}
                    onChange={(e) =>
                      updateRoom(idx, { bedCount: e.target.value })
                    }
                    disabled={pending}
                    className="input"
                  />
                </Field>
                <Field label="Status" required>
                  <select
                    value={r.status}
                    onChange={(e) =>
                      updateRoom(idx, {
                        status: e.target.value as RoomDraft['status'],
                      })
                    }
                    disabled={pending}
                    className="input"
                  >
                    <option value="available">Available</option>
                    <option value="occupied">Occupied</option>
                  </select>
                </Field>
              </div>

              {/* Body row 2: Description, full width */}
              <Field label="Room description" hint="Optional">
                <input
                  type="text"
                  value={r.description}
                  onChange={(e) =>
                    updateRoom(idx, { description: e.target.value })
                  }
                  disabled={pending}
                  className="input"
                  placeholder="e.g. South-facing, en-suite bathroom"
                />
              </Field>
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
