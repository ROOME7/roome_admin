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

const FILTERS: StatusFilter[] = ['all', 'on_market', 'off_market', 'deleted'];

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
  q?: string;
  cursor?: string;
}): string {
  const search = new URLSearchParams();
  if (params.status && params.status !== 'all') search.set('status', params.status);
  if (params.q) search.set('q', params.q);
  if (params.cursor) search.set('cursor', params.cursor);
  const qs = search.toString();
  return qs ? `/listings?${qs}` : '/listings';
}
