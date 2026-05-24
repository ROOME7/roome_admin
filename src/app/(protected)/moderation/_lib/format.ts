// Shared formatting helpers used by both the list page and the detail page.

import type { Timestamp } from 'firebase-admin/firestore';
import type { TFunc } from '@/i18n/t';
import type {
  Report,
  ReportReason,
  ReportStatus,
  ReportTargetType,
} from './types';

export function timestampToDate(value: unknown): Date | null {
  if (!value) return null;
  if (value instanceof Date) return value;
  if (typeof value === 'object' && value !== null && 'toDate' in value) {
    try {
      return (value as Timestamp).toDate();
    } catch {
      return null;
    }
  }
  return null;
}

export function asStatus(v: unknown): ReportStatus {
  if (v === 'reviewing' || v === 'resolved' || v === 'dismissed') return v;
  return 'open';
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

export function asStringMap(v: unknown): Record<string, string> {
  if (!v || typeof v !== 'object') return {};
  const out: Record<string, string> = {};
  for (const [k, val] of Object.entries(v as Record<string, unknown>)) {
    if (typeof val === 'string') out[k] = val;
  }
  return out;
}

export function mapReportDoc(
  id: string,
  data: FirebaseFirestore.DocumentData
): Report {
  return {
    id,
    reporterUid: typeof data.reporterUid === 'string' ? data.reporterUid : '',
    targetType: asTargetType(data.targetType),
    targetId: typeof data.targetId === 'string' ? data.targetId : '',
    targetOwnerUid:
      typeof data.targetOwnerUid === 'string' && data.targetOwnerUid.length > 0
        ? data.targetOwnerUid
        : null,
    reason: asReason(data.reason),
    // Legacy docs (pre-rename) stored the user note under `details`.
    note:
      typeof data.note === 'string'
        ? data.note
        : typeof data.details === 'string'
          ? data.details
          : '',
    context: asStringMap(data.context),
    status: asStatus(data.status),
    actionTaken:
      typeof data.actionTaken === 'string' && data.actionTaken.length > 0
        ? data.actionTaken
        : null,
    resolvedByAdminUid:
      typeof data.resolvedByAdminUid === 'string'
        ? data.resolvedByAdminUid
        : typeof data.reviewedByAdminUid === 'string'
          ? data.reviewedByAdminUid
          : null,
    resolvedAt:
      timestampToDate(data.resolvedAt) ?? timestampToDate(data.reviewedAt),
    createdAt:
      timestampToDate(data.serverCreatedAt) ?? timestampToDate(data.createdAt),
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
