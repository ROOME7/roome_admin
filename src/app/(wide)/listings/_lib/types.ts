// The shapes `/admin/properties` returns, and the one the table renders.
//
// Kept in their own file for the same reason the users page does it: the page
// and the actions both need them, and a type defined inside a Server Component
// cannot be imported by a Client one.

export type ListingStatus = 'on_market' | 'off_market' | 'deleted';

/** Exactly what the API sends. */
export interface ApiProperty {
  id: string;
  title: string;
  city: string;
  province: string | null;
  propertyType: string | null;
  partnerName: string | null;
  /** Null means it was created in the app — the signal that says "test row". */
  source: string | null;
  owner: { id: string; email: string; username: string; name: string | null };
  roomCount: number;
  activeListings: number;
  /** Non-zero means deleting this touches somebody who applied. */
  contractCount: number;
  /** Live rooms with a calendar feed attached. */
  icalRooms: number;
  hasIcal: boolean;
  icalLastSyncedAt: string | null;
  /**
   * A feed is attached and has never run.
   *
   * ⚠️ NOT A FAILURE. The sync is a nightly cron at 05:00 Europe/Rome, so a
   * landlord who saves a URL in the evening has a feed in exactly this state
   * until morning. The column says "pending" rather than showing a tick that
   * is not yet earned or a cross that is not deserved.
   */
  icalNeverSynced: boolean;
  isOnMarket: boolean;
  isPublished: boolean;
  status: ListingStatus;
  deletedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PropertyRow extends Omit<ApiProperty, 'createdAt' | 'deletedAt'> {
  createdAt: Date;
  deletedAt: Date | null;
}

export interface PropertyCounts {
  all: number;
  onMarket: number;
  offMarket: number;
  deleted: number;
}

export type StatusFilter = 'all' | 'on_market' | 'off_market' | 'deleted';

/** The iCal column, as a filter. `all` is this screen's word for "no filter". */
export type IcalFilter = 'all' | 'yes' | 'no';

const FILTERS: StatusFilter[] = ['all', 'on_market', 'off_market', 'deleted'];
const ICAL_FILTERS: IcalFilter[] = ['all', 'yes', 'no'];

/** An unknown ?ical= is "all", for the same reason an unknown ?status= is. */
export function asIcalFilter(raw: unknown): IcalFilter {
  return typeof raw === 'string' && (ICAL_FILTERS as string[]).includes(raw)
    ? (raw as IcalFilter)
    : 'all';
}

/** An unknown ?status= is "all" rather than an error — a stale link should still show something. */
export function asStatusFilter(raw: unknown): StatusFilter {
  return typeof raw === 'string' && (FILTERS as string[]).includes(raw)
    ? (raw as StatusFilter)
    : 'all';
}

export function mapProperty(p: ApiProperty): PropertyRow {
  return {
    ...p,
    createdAt: new Date(p.createdAt),
    deletedAt: p.deletedAt ? new Date(p.deletedAt) : null,
  };
}

/** The query string for a link back to this screen, with one part changed. */
export function listingsHref(params: {
  status?: StatusFilter;
  ical?: IcalFilter;
  q?: string;
  cursor?: string;
}): string {
  const search = new URLSearchParams();
  if (params.status && params.status !== 'all') search.set('status', params.status);
  if (params.ical && params.ical !== 'all') search.set('ical', params.ical);
  if (params.q) search.set('q', params.q);
  if (params.cursor) search.set('cursor', params.cursor);
  const qs = search.toString();
  return qs ? `/listings?${qs}` : '/listings';
}

// ── the detail endpoint ────────────────────────────────────────────────────

/** A room's calendar feed, and what the nightly sync last made of it. */
export interface RoomCalendar {
  id: string;
  /**
   * ⚠️ REDACTED ON THE SERVER — the full URL never reaches the browser.
   *
   * It is a credential: anyone holding it can read the landlord's bookings,
   * and it cannot be revoked without reissuing the link at the far end. What
   * is left identifies the feed without granting access.
   */
  url: { host: string; preview: string; length: number };
  source: string | null;
  active: boolean;
  lastSyncedAt: string | null;
  /** `ok`, `unchanged`, or the failure — `blocked`, `invalid_url`, an HTTP status. */
  lastStatus: string | null;
  /**
   * ⚠️ ALSO SET ON A SUCCESSFUL SYNC that skipped events, naming how many and
   * why — so its presence does not mean the feed is broken. Read it with
   * `failureCount`, which is the field that does.
   */
  lastError: string | null;
  /** Consecutive failures. Zero after any success. */
  failureCount: number;
  /** Attached, never run. Usually the 05:00 cron has not come round yet. */
  neverSynced: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface IcalBlock {
  id: string;
  startDate: string;
  /** EXCLUSIVE, as iCalendar defines DTEND. */
  endDate: string;
  summary: string | null;
  externalUid: string | null;
  current: boolean;
  updatedAt: string;
}

export interface RoomDetail {
  id: string;
  name: string | null;
  type: string;
  status: string;
  priceCents: number;
  currency: string;
  bedCount: number;
  occupiedBeds: number;
  isPublished: boolean;
  availableFrom: string | null;
  listing: { id: string; status: string; publishedAt: string | null } | null;
  calendar: RoomCalendar | null;
  icalBlocks: IcalBlock[];
  icalBlockCount: number;
}

export interface PropertyDetail extends ApiProperty {
  street: string;
  civic: string | null;
  postalCode: string | null;
  neighborhood: string | null;
  region: string | null;
  country: string;
  lat: number | null;
  lng: number | null;
  description: string | null;
  floor: number | null;
  totalRooms: number | null;
  totalBeds: number | null;
  totalBathrooms: number | null;
  availableFrom: string | null;
  area: { id: string; name: string } | null;
  rooms: RoomDetail[];
}
