// Shared types for the UGC Moderation flow.
// Server-only; never imported from a 'use client' component.
//
// Field shape matches docs/architecture/app-store-rejection-2026-05-24.md.

export type ReportStatus = 'open' | 'reviewing' | 'resolved' | 'dismissed';

export const ALL_FILTERS = ['open', 'reviewing', 'resolved', 'dismissed', 'all'] as const;
export type FilterValue = (typeof ALL_FILTERS)[number];

export function asFilter(raw: string | string[] | undefined): FilterValue {
  const v = Array.isArray(raw) ? raw[0] : raw;
  return (ALL_FILTERS as readonly string[]).includes(v ?? '')
    ? (v as FilterValue)
    : 'open';
}

// Mirrors `ReportTargetType` enum on the Flutter client (see
// lib/core/data/repositories/reports_repository/reports_repository.dart).
export type ReportTargetType = 'user' | 'listing' | 'message' | 'review';
export type ReportReason =
  | 'spam'
  | 'harassment'
  | 'inappropriate'
  | 'fraud'
  | 'impersonation'
  | 'other';

export interface Report {
  id: string;
  reporterUid: string;
  targetType: ReportTargetType;
  targetId: string;
  /// Account that owns the reported content — the listing's owner, the
  /// message sender, the review's `fromUid`, or the reported user
  /// themselves. Used to render the "target" mini-profile + suspend
  /// action without an extra lookup. Null for legacy reports created
  /// before the field was added.
  targetOwnerUid: string | null;
  reason: ReportReason;
  note: string;
  context: Record<string, string>;
  status: ReportStatus;
  actionTaken: string | null;
  resolvedByAdminUid: string | null;
  resolvedAt: Date | null;
  createdAt: Date | null;
}
