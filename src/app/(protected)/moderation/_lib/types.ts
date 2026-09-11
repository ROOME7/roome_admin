// Shared types for the UGC Moderation flow.
// Server-only; never imported from a 'use client' component.
//
// ⚠️ THE PANEL SAYS `resolved`, THE API SAYS `actioned`. Same state, two
// vocabularies — the column has been RESOLVED since the start and the wire
// chose the word the product spec uses. The mapping lives in `_lib/format.ts`
// and nowhere else; every screen below keeps saying `resolved`.

export type ReportStatus = 'open' | 'reviewing' | 'resolved' | 'dismissed';

export const ALL_FILTERS = ['open', 'reviewing', 'resolved', 'dismissed', 'all'] as const;
export type FilterValue = (typeof ALL_FILTERS)[number];

export function asFilter(raw: string | string[] | undefined): FilterValue {
  const v = Array.isArray(raw) ? raw[0] : raw;
  return (ALL_FILTERS as readonly string[]).includes(v ?? '')
    ? (v as FilterValue)
    : 'open';
}

export type ReportTargetType = 'user' | 'listing' | 'message' | 'review';
export type ReportReason =
  | 'spam'
  | 'harassment'
  | 'inappropriate'
  | 'fraud'
  | 'impersonation'
  | 'other';

/** A party to a report, as the API embeds it. Null when the account is gone. */
export interface Party {
  id: string;
  username: string;
  name: string | null;
}

/** One row of `GET /admin/reports`, before mapping. */
export interface ApiReport {
  id: string;
  reporterId: string;
  targetType: string;
  targetId: string;
  targetOwnerId: string | null;
  reason: string;
  note: string | null;
  context: Record<string, unknown> | null;
  status: string;
  createdAt: string;
  // Admin-only half.
  resolution: string | null;
  resolvedAt: string | null;
  resolvedBy: string | null;
  reporter: Party | null;
  targetOwner: Party | null;
}

export interface Report {
  id: string;
  reporterUid: string;
  /** Embedded by the API — no second lookup, and null means erased. */
  reporter: Party | null;
  targetType: ReportTargetType;
  targetId: string;
  /**
   * Account that owns the reported content — the listing's owner, the message
   * sender, the review's author, or the reported user themselves. Null when
   * the target was already gone when the report was filed.
   */
  targetOwnerUid: string | null;
  targetOwner: Party | null;
  reason: ReportReason;
  note: string;
  context: Record<string, string>;
  status: ReportStatus;
  /** The moderator's record of the decision. Never shown to the reporter. */
  actionTaken: string | null;
  resolvedByAdminUid: string | null;
  resolvedAt: Date | null;
  createdAt: Date | null;
}
