// The API's audit trail — `GET /admin/audit` — and how a row reads on screen.
//
// ⚠️ A DIFFERENT TRAIL FROM `lib/audit.ts`, NOT A REPLACEMENT YET. That file
// reads `adminAccountActions` in Firestore and still backs the Active
// Management activity dialog, which has not been migrated. This one reads the
// append-only `admin_actions` table, which every privileged decision in the
// API has been writing all along — suspensions, B2B approvals, report
// decisions, the grant-admin script — with nothing able to show them.
//
// The two vocabularies are deliberately not merged: `suspend` and
// `user.suspend` are the same decision recorded by two different systems, and
// pretending otherwise would attribute one to the other.

import 'server-only';
import { apiAuthed } from '@/lib/session';
import type { TFunc } from '@/i18n/t';

export interface AuditParty {
  id: string;
  email: string | null;
  username: string;
}

export interface AuditEntry {
  id: string;
  action: string;
  entityType: string | null;
  entityId: string | null;
  /** Set when an admin acted for a customer rather than as themselves. */
  onBehalfOf: string | null;
  actor: AuditParty | null;
  target: AuditParty | null;
  at: Date | null;
}

interface ApiAuditRow {
  id: string;
  action: string;
  entityType: string | null;
  entityId: string | null;
  before: unknown;
  after: unknown;
  onBehalfOf: string | null;
  actor: AuditParty | null;
  target: AuditParty | null;
  createdAt: string;
}

/**
 * Recent admin decisions, newest first.
 *
 * Never throws: the dashboard renders an empty feed rather than a 500 if the
 * trail is unavailable — every other panel on that page is still useful.
 */
export async function getRecentAuditEntries(limit = 20): Promise<AuditEntry[]> {
  try {
    const res = await apiAuthed<{ items: ApiAuditRow[] }>(
      `/admin/audit?limit=${Math.max(1, Math.min(limit, 200))}`,
    );
    return (res?.items ?? []).map((r) => ({
      id: r.id,
      action: r.action,
      entityType: r.entityType,
      entityId: r.entityId,
      onBehalfOf: r.onBehalfOf,
      actor: r.actor,
      target: r.target,
      at: r.createdAt ? new Date(r.createdAt) : null,
    }));
  } catch {
    return [];
  }
}

export interface FormattedAuditEntry {
  title: string;
  detail: string;
  tone: 'neutral' | 'positive' | 'warning' | 'destructive';
}

const TITLES: Record<string, { key: string; tone: FormattedAuditEntry['tone'] }> = {
  'user.suspend': { key: 'audit.apiUserSuspend', tone: 'warning' },
  'user.restore': { key: 'audit.apiUserRestore', tone: 'positive' },
  'user.grant_admin': { key: 'audit.apiUserGrantAdmin', tone: 'warning' },
  'user.revoke_admin': { key: 'audit.apiUserRevokeAdmin', tone: 'destructive' },
  'user.create_admin': { key: 'audit.apiUserCreateAdmin', tone: 'warning' },
  'b2b.approve': { key: 'audit.apiB2bApprove', tone: 'positive' },
  'b2b.reject': { key: 'audit.apiB2bReject', tone: 'destructive' },
  'report.actioned': { key: 'audit.apiReportActioned', tone: 'positive' },
  'report.dismissed': { key: 'audit.apiReportDismissed', tone: 'neutral' },
  'report.reviewing': { key: 'audit.apiReportReviewing', tone: 'neutral' },
  'area.create': { key: 'audit.apiAreaCreate', tone: 'positive' },
  'area.update': { key: 'audit.apiAreaUpdate', tone: 'neutral' },
  'area.delete': { key: 'audit.apiAreaDelete', tone: 'destructive' },
};

export function formatAuditEntry(entry: AuditEntry, t: TFunc): FormattedAuditEntry {
  // An unknown action still renders — as its raw name, which is more use to
  // whoever added it than a blank row would be.
  const known = TITLES[entry.action];
  const title = known ? t(known.key) : `${t('audit.apiUnknown')} · ${entry.action}`;

  const who = entry.target?.email || entry.target?.username || entry.target?.id || '';
  const detail = entry.onBehalfOf
    ? [who, t('audit.onBehalfOf', { who: entry.onBehalfOf })].filter(Boolean).join(' · ')
    : who;

  return { title, detail, tone: known?.tone ?? 'neutral' };
}
