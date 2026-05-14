import type { ManagedStatus, OwnerType } from '../_lib/types';

const STATUS_STYLES: Record<ManagedStatus, string> = {
  active: 'bg-primary/10 text-primary ring-primary/20',
  suspended: 'bg-amber-500/10 text-amber-700 ring-amber-500/30',
  handed_over: 'bg-muted text-muted-foreground ring-border',
  archived: 'bg-destructive/10 text-destructive ring-destructive/30',
};
const STATUS_LABELS: Record<ManagedStatus, string> = {
  active: 'Managed',
  suspended: 'Suspended',
  handed_over: 'Handed over',
  archived: 'Archived',
};

export function StatusBadge({ status }: { status: ManagedStatus }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${STATUS_STYLES[status]}`}
    >
      {STATUS_LABELS[status]}
    </span>
  );
}

const TYPE_LABELS: Record<OwnerType, string> = {
  owner_b2c: 'Private',
  owner_b2b: 'Institutional',
};

export function OwnerTypeBadge({ ownerType }: { ownerType: OwnerType }) {
  return (
    <span className="inline-flex items-center rounded-full bg-secondary px-2.5 py-0.5 text-xs font-medium text-foreground ring-1 ring-inset ring-border">
      {TYPE_LABELS[ownerType]}
    </span>
  );
}
