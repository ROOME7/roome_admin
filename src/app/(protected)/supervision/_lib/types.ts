// Shared types for the Supervision flow.
// Server-only; never imported from a 'use client' component.

export type B2bStatus = 'pending' | 'approved' | 'rejected';

export const ALL_FILTERS = ['pending', 'approved', 'rejected', 'all'] as const;
export type FilterValue = (typeof ALL_FILTERS)[number];

export function asFilter(raw: string | string[] | undefined): FilterValue {
  const v = Array.isArray(raw) ? raw[0] : raw;
  return (ALL_FILTERS as readonly string[]).includes(v ?? '')
    ? (v as FilterValue)
    : 'pending';
}

/**
 * One row of `GET /admin/b2b-requests`.
 *
 * ⚠️ `status` ARRIVES UPPERCASE HERE, unlike every other enum on this API.
 * It is documented that way in the OpenAPI schema and the mobile app reads the
 * same field, so it is normalised on this side rather than changed under a
 * shipped client.
 */
export interface ApiB2bRequest {
  id: string;
  ticketRef: string;
  status: string;
  companyName: string;
  vatNumber: string;
  pec: string | null;
  adminName: string | null;
  phoneNumber: string | null;
  notes: string | null;
  submittedAt: string | null;
  decidedAt: string | null;
  owner: {
    id: string;
    email: string;
    firstName: string | null;
    lastName: string | null;
    username: string;
    phoneNumber: string | null;
    createdAt: string;
  } | null;
}

export interface B2bRequest {
  id: string;
  /** Support reference the applicant was given. Quote it, not the id. */
  ticketRef: string;
  ownerUid: string;
  ownerEmail: string | null;
  ownerName: string | null;
  companyName: string;
  vatNumber: string;
  pec: string | null;
  adminName: string | null;
  phoneNumber: string | null;
  status: B2bStatus;
  notes: string | null;
  submittedAt: Date | null;
  reviewedAt: Date | null;
}

function asDate(iso: string | null): Date | null {
  if (!iso) return null;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function statusFromApi(v: string): B2bStatus {
  const s = v?.toLowerCase();
  return s === 'approved' || s === 'rejected' ? s : 'pending';
}

export function mapApiRequest(r: ApiB2bRequest): B2bRequest {
  const name = [r.owner?.firstName, r.owner?.lastName].filter(Boolean).join(' ').trim();
  return {
    id: r.id,
    ticketRef: r.ticketRef,
    ownerUid: r.owner?.id ?? '',
    ownerEmail: r.owner?.email ?? null,
    ownerName: name || r.owner?.username || null,
    companyName: r.companyName,
    vatNumber: r.vatNumber,
    pec: r.pec,
    adminName: r.adminName,
    phoneNumber: r.phoneNumber ?? r.owner?.phoneNumber ?? null,
    status: statusFromApi(r.status),
    notes: r.notes,
    submittedAt: asDate(r.submittedAt),
    reviewedAt: asDate(r.decidedAt),
  };
}
