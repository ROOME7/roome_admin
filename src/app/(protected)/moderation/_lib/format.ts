// Shared formatting helpers used by both the list page and the detail page.
//
// ⚠️ THE FIRESTORE MAPPERS ARE GONE. `mapReportDoc` read a document that had
// accumulated two names for half its fields — `details` for `note`,
// `reviewedByAdminUid` for `resolvedByAdminUid` — because nothing enforced a
// shape. One API shape replaces all of it.

import type { TFunc } from '@/i18n/t';
import type {
  ApiReport,
  Report,
  ReportReason,
  ReportStatus,
  ReportTargetType,
} from './types';

/** Wire → panel. The API's `actioned` is what this panel calls `resolved`. */
export function statusFromApi(v: string): ReportStatus {
  if (v === 'reviewing' || v === 'dismissed') return v;
  if (v === 'actioned' || v === 'resolved') return 'resolved';
  return 'open';
}

/** Panel → wire, for the PATCH body and the `status` query. */
export function statusToApi(v: Exclude<ReportStatus, 'open'>): string {
  return v === 'resolved' ? 'actioned' : v;
}

export function asTargetType(v: unknown): ReportTargetType {
  if (v === 'listing' || v === 'message' || v === 'review') return v;
  return 'user';
}

export function asReason(v: unknown): ReportReason {
  const allowed: ReportReason[] = [
    'spam',
    'harassment',
    'inappropriate',
    'fraud',
    'impersonation',
    'other',
  ];
  return allowed.includes(v as ReportReason) ? (v as ReportReason) : 'other';
}

/**
 * `context` is whatever the client captured when the report was filed — a chat
 * id, a message preview, a price. Non-string values are dropped rather than
 * stringified: `[object Object]` in a moderator's evidence panel is worse than
 * a missing row.
 */
export function asStringMap(v: unknown): Record<string, string> {
  if (!v || typeof v !== 'object') return {};
  const out: Record<string, string> = {};
  for (const [k, val] of Object.entries(v as Record<string, unknown>)) {
    if (typeof val === 'string') out[k] = val;
    else if (typeof val === 'number' || typeof val === 'boolean') out[k] = String(val);
  }
  return out;
}

function asDate(iso: string | null): Date | null {
  if (!iso) return null;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function mapApiReport(r: ApiReport): Report {
  return {
    id: r.id,
    reporterUid: r.reporterId,
    reporter: r.reporter ?? null,
    targetType: asTargetType(r.targetType),
    targetId: r.targetId,
    targetOwnerUid: r.targetOwnerId,
    targetOwner: r.targetOwner ?? null,
    reason: asReason(r.reason),
    note: r.note ?? '',
    context: asStringMap(r.context),
    status: statusFromApi(r.status),
    actionTaken: r.resolution ?? null,
    resolvedByAdminUid: r.resolvedBy ?? null,
    resolvedAt: asDate(r.resolvedAt),
    createdAt: asDate(r.createdAt),
  };
}

const dateFormatter = new Intl.DateTimeFormat('en-GB', {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
});

export function formatDate(d: Date | null): string {
  if (!d) return '—';
  return dateFormatter.format(d);
}

export function reasonLabel(reason: ReportReason, t: TFunc): string {
  switch (reason) {
    case 'spam':
      return t('moderation.reasonSpam');
    case 'harassment':
      return t('moderation.reasonHarassment');
    case 'inappropriate':
      return t('moderation.reasonInappropriate');
    case 'fraud':
      return t('moderation.reasonFraud');
    case 'impersonation':
      return t('moderation.reasonImpersonation');
    case 'other':
      return t('moderation.reasonOther');
  }
}

export function targetTypeLabel(type: ReportTargetType, t: TFunc): string {
  switch (type) {
    case 'user':
      return t('moderation.targetUser');
    case 'listing':
      return t('moderation.targetListing');
    case 'message':
      return t('moderation.targetMessage');
    case 'review':
      return t('moderation.targetReview');
  }
}
