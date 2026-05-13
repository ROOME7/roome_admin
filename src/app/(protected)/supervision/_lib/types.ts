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

export interface B2bRequest {
  id: string;
  ownerUid: string;
  companyName: string;
  vatNumber: string;
  pec: string | null;
  phoneNumber: string | null;
  status: B2bStatus;
  notes: string | null;
  submittedAt: Date | null;
  reviewedAt: Date | null;
  reviewedByAdminUid: string | null;
}
