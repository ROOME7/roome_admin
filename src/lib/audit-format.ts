// Pure presentation helpers for adminAccountActions entries — imported
// by both Server Components (audit.ts's read helpers feed them) and
// 'use client' dialogs that render the activity timeline. Lives outside
// audit.ts because audit.ts is 'server-only' (firebase-admin imports).
//
// formatAdminAction is locale-aware: callers pass a `t` function (from
// getT() server-side or useT() client-side). Dynamic data — reasons,
// emails, amounts, IDs — is passed through verbatim; only the fixed
// phrasing is translated.

import type { TFunc } from '@/i18n/t';

export interface AdminActionEntry {
  id: string;
  adminUid: string;
  targetUid: string;
  action: string;
  payload: Record<string, unknown>;
  /** Serialized to plain Date because Firestore Timestamp doesn't serialize
   *  across the server-component → client-component boundary. */
  at: Date | null;
}

export interface FormattedAction {
  /** Short one-line description, e.g. "Suspended account". */
  title: string;
  /** Optional detail (e.g. reason text). May be empty. */
  detail: string;
  /** Visual tone for the row's icon / chip. */
  tone: 'neutral' | 'positive' | 'warning' | 'destructive';
}

export function formatAdminAction(
  entry: AdminActionEntry,
  t: TFunc
): FormattedAction {
  const p = entry.payload;
  const via = typeof p.via === 'string' ? (p.via as string) : null;

  switch (entry.action) {
    case 'edit_profile':
      return {
        title: t('audit.editProfile'),
        detail: Array.isArray(p.fields) ? (p.fields as unknown[]).join(', ') : '',
        tone: 'neutral',
      };
    case 'set_note':
      return {
        title: t('audit.setNote'),
        detail:
          typeof p.length === 'number'
            ? t('audit.charsCount', { count: p.length as number })
            : '',
        tone: 'neutral',
      };
    case 'set_tags':
      return {
        title: t('audit.setTags'),
        detail: Array.isArray(p.tags)
          ? (p.tags as unknown[]).join(', ') || t('audit.tagsCleared')
          : '',
        tone: 'neutral',
      };
    case 'suspend':
      return {
        title: t('audit.suspend'),
        detail: typeof p.reason === 'string' ? (p.reason as string) : '',
        tone: 'warning',
      };
    case 'reactivate':
      return {
        title: t('audit.reactivate'),
        detail:
          typeof p.listingsRestored === 'number'
            ? t('audit.listingsRestored', { count: p.listingsRestored as number })
            : '',
        tone: 'positive',
      };
    case 'archive':
      return {
        title: t('audit.archive'),
        detail: typeof p.reason === 'string' ? (p.reason as string) : '',
        tone: 'destructive',
      };
    case 'reclaim':
      return { title: t('audit.reclaim'), detail: '', tone: 'positive' };
    case 'set_waiver': {
      const active = p.active === true;
      return {
        title: active ? t('audit.waiverGranted') : t('audit.waiverRevoked'),
        detail: active && typeof p.reason === 'string' ? (p.reason as string) : '',
        tone: active ? 'positive' : 'neutral',
      };
    }
    case 'refund':
      return {
        title: t('audit.refund'),
        detail:
          typeof p.amountCents === 'number'
            ? `€${((p.amountCents as number) / 100).toFixed(2)}`
            : '',
        tone: 'warning',
      };
    case 'trigger_connect_onboarding':
      return {
        title: t('audit.connectOnboarding'),
        detail: typeof p.accountId === 'string' ? (p.accountId as string) : '',
        tone: 'neutral',
      };
    case 'grant_admin':
      return {
        title: t('audit.grantAdmin'),
        detail: typeof p.email === 'string' ? (p.email as string) : '',
        tone: 'positive',
      };
    case 'revoke_admin':
      return {
        title: t('audit.revokeAdmin'),
        detail: '',
        tone: 'destructive',
      };
    case 'notify':
      // 'notify' is overloaded — also used by on-behalf ops from
      // /managed/[uid]/operate (sendChatMessageAs, updateListingAs,
      // respondToApplicationAs, publishListingAs, uploadListingPhotoAs).
      // Disambiguate via payload.via.
      switch (via) {
        case 'send_message_as':
          return {
            title: t('audit.sendMessageAs'),
            detail:
              typeof p.chatId === 'string'
                ? t('audit.chatRef', { id: (p.chatId as string).slice(0, 8) })
                : '',
            tone: 'neutral',
          };
        case 'edit_listing_as':
          return {
            title: t('audit.editListingAs'),
            detail: Array.isArray(p.fieldsUpdated)
              ? (p.fieldsUpdated as unknown[]).join(', ')
              : '',
            tone: 'neutral',
          };
        case 'respond_application_as':
          return {
            title:
              p.decision === 'accept'
                ? t('audit.acceptApplicationAs')
                : t('audit.declineApplicationAs'),
            detail:
              typeof p.contractId === 'string'
                ? t('audit.contractRef', {
                    id: (p.contractId as string).slice(0, 8),
                  })
                : '',
            tone: p.decision === 'accept' ? 'positive' : 'warning',
          };
        case 'publish_listing_as':
          return {
            title: t('audit.publishListingAs'),
            detail:
              typeof p.roomCount === 'number'
                ? t('audit.roomsBeds', {
                    rooms: p.roomCount as number,
                    beds: (p.totalBeds as number | undefined) ?? '?',
                  })
                : '',
            tone: 'positive',
          };
        case 'upload_photo_as':
          return {
            title: t('audit.uploadPhotoAs'),
            detail:
              typeof p.propertyId === 'string'
                ? t('audit.propertyRef', {
                    id: (p.propertyId as string).slice(0, 8),
                  })
                : '',
            tone: 'neutral',
          };
        default:
          return {
            title: t('audit.partnerNotification'),
            detail: typeof p.title === 'string' ? (p.title as string) : '',
            tone: 'neutral',
          };
      }
    case 'report_take_over':
      return {
        title: t('audit.reportTakeOver'),
        detail: typeof p.reportId === 'string' ? (p.reportId as string) : '',
        tone: 'neutral',
      };
    case 'report_resolve':
      return {
        title: t('audit.reportResolve'),
        detail: typeof p.actionTaken === 'string' ? (p.actionTaken as string) : '',
        tone: 'positive',
      };
    case 'report_dismiss':
      return {
        title: t('audit.reportDismiss'),
        detail: typeof p.actionTaken === 'string' ? (p.actionTaken as string) : '',
        tone: 'neutral',
      };
    default:
      return { title: entry.action, detail: '', tone: 'neutral' };
  }
}
