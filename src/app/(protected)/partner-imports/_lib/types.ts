// The shapes the import screens render. Mirrors what
// `GET /admin/partner-imports/:id` returns.
//
// ⚠️ THERE IS NO CALENDAR URL HERE, AND THERE MUST NOT BE. The feed link
// carries the token that reads a partner's bookings; the API sends
// `hasCalendarFeed` instead, and this type has nowhere to put a URL even if
// one arrived.

export type PlanAction = 'create' | 'update' | 'unchanged' | 'blocked';

export interface FieldChange {
  field: string;
  from: unknown;
  to: unknown;
}

export interface RowIssue {
  level: 'error' | 'note';
  field: string;
  message: string;
}

export interface RoomPlan {
  action: PlanAction;
  sheet: string;
  row: number;
  label: string;
  externalRef: string | null;
  existingId: string | null;
  values: Record<string, unknown>;
  changes: FieldChange[];
  issues: RowIssue[];
  blockers: string[];
  hasCalendarFeed: boolean;
}

export interface PropertyPlan {
  action: PlanAction;
  key: string;
  sheet: string;
  row: number;
  label: string;
  externalRef: string | null;
  existingId: string | null;
  values: Record<string, unknown>;
  changes: FieldChange[];
  issues: RowIssue[];
  blockers: string[];
  rooms: RoomPlan[];
}

export interface ImportPlan {
  properties: PropertyPlan[];
  fileIssues: string[];
  summary: {
    propertiesCreated: number;
    propertiesUpdated: number;
    propertiesUnchanged: number;
    roomsCreated: number;
    roomsUpdated: number;
    roomsUnchanged: number;
    roomsBlocked: number;
    rowsWithErrors: number;
    calendarFeeds: number;
  };
}

export interface ColumnMapping {
  column: number;
  field: string;
  extract?: { pattern: string; group: number };
}

export interface ImportProfileSpec {
  sheets: { mode: string; names?: string[]; nameFills?: string };
  headerRow: number;
  stopWhen?: { keyColumnEmpty?: number; rowMatches?: string };
  layout: Record<string, unknown> & { kind: string };
  columns: ColumnMapping[];
  defaults: Record<string, string>;
}

export interface FieldDef {
  name: string;
  scope: 'property' | 'room';
  kind: string;
  label: string;
  requiredToPublish: boolean;
}

export interface ImportDetail {
  id: string;
  owner: { id: string; email: string };
  profile: { id: string; name: string } | null;
  fileName: string;
  fileSize: number;
  status: string;
  counts: Record<string, number> | null;
  committedAt: string | null;
  createdAt: string;
  notes: { level: 'info' | 'warning'; message: string }[];
  problems?: { code: string; message: string }[];
  mapping: ImportProfileSpec | null;
  plan: ImportPlan | null;
  headers?: string[];
  headerHash?: string | null;
  fields?: FieldDef[];
  alreadyCommittedAt?: string | null;
}
