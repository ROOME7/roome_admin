// Status pill for B2B requests. Server-renderable; no JS needed.
//
// The 'pending' colour deliberately uses the muted/secondary palette
// rather than a yellow/orange to keep the queue feeling "neutral until
// reviewed". Approved → success green, rejected → destructive red.

import type { B2bStatus } from '../_lib/types';

const STYLES: Record<B2bStatus, string> = {
  pending: 'bg-secondary text-foreground ring-border',
  approved: 'bg-success/10 text-success ring-success/20',
  rejected: 'bg-destructive/10 text-destructive ring-destructive/20',
};

const LABELS: Record<B2bStatus, string> = {
  pending: 'Pending',
  approved: 'Approved',
  rejected: 'Rejected',
};

export function StatusBadge({ status }: { status: B2bStatus }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${STYLES[status]}`}
    >
      {LABELS[status]}
    </span>
  );
}
