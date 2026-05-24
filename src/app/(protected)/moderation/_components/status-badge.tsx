import type { ReportStatus } from '../_lib/types';
import type { TFunc } from '@/i18n/t';

const STYLES: Record<ReportStatus, string> = {
  open: 'bg-secondary text-foreground ring-border',
  reviewing: 'bg-warning/10 text-warning ring-warning/20',
  resolved: 'bg-success/10 text-success ring-success/20',
  dismissed: 'bg-muted text-muted-foreground ring-border',
};

export function StatusBadge({ status, t }: { status: ReportStatus; t: TFunc }) {
  const LABELS: Record<ReportStatus, string> = {
    open: t('moderation.statusOpen'),
    reviewing: t('moderation.statusReviewing'),
    resolved: t('moderation.statusResolved'),
    dismissed: t('moderation.statusDismissed'),
  };

  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${STYLES[status]}`}
    >
      {LABELS[status]}
    </span>
  );
}
