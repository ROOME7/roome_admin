// Pure presentation helpers for adminAccountActions entries — imported
// by both Server Components (audit.ts's read helpers feed them) and
// 'use client' dialogs that render the activity timeline. Lives outside
// audit.ts because audit.ts is 'server-only' (firebase-admin imports).

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

export function formatAdminAction(entry: AdminActionEntry): FormattedAction {
  const p = entry.payload;
  const via = typeof p.via === 'string' ? (p.via as string) : null;

  switch (entry.action) {
    case 'edit_profile':
      return {
        title: 'Edited profile',
        detail: Array.isArray(p.fields) ? (p.fields as unknown[]).join(', ') : '',
        tone: 'neutral',
      };
    case 'set_note':
      return {
        title: 'Updated admin notes',
        detail: typeof p.length === 'number' ? `${p.length} chars` : '',
        tone: 'neutral',
      };
    case 'set_tags':
      return {
        title: 'Updated tags',
        detail: Array.isArray(p.tags)
          ? (p.tags as unknown[]).join(', ') || '(cleared)'
          : '',
        tone: 'neutral',
      };
    case 'suspend':
      return {
        title: 'Suspended account',
        detail: typeof p.reason === 'string' ? (p.reason as string) : '',
        tone: 'warning',
      };
    case 'reactivate':
      return {
        title: 'Reactivated account',
        detail:
          typeof p.listingsRestored === 'number'
            ? `${p.listingsRestored} listing(s) restored`
            : '',
        tone: 'positive',
      };
    case 'archive':
      return {
        title: 'Archived account',
        detail: typeof p.reason === 'string' ? (p.reason as string) : '',
        tone: 'destructive',
      };
    case 'reclaim':
      return { title: 'Reclaimed management', detail: '', tone: 'positive' };
    case 'set_waiver': {
      const active = p.active === true;
      return {
        title: active
          ? 'Granted subscription waiver'
          : 'Revoked subscription waiver',
        detail: active && typeof p.reason === 'string' ? (p.reason as string) : '',
        tone: active ? 'positive' : 'neutral',
      };
    }
    case 'refund':
      return {
        title: 'Refunded subscription invoice',
        detail:
          typeof p.amountCents === 'number'
            ? `€${((p.amountCents as number) / 100).toFixed(2)}`
            : '',
        tone: 'warning',
      };
    case 'trigger_connect_onboarding':
      return {
        title: 'Sent Connect onboarding link',
        detail: typeof p.accountId === 'string' ? (p.accountId as string) : '',
        tone: 'neutral',
      };
    case 'grant_admin':
      return {
        title: 'Granted admin role',
        detail: typeof p.email === 'string' ? (p.email as string) : '',
        tone: 'positive',
      };
    case 'revoke_admin':
      return {
        title: 'Revoked admin role',
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
            title: 'Sent chat message as partner',
            detail:
              typeof p.chatId === 'string'
                ? `chat ${(p.chatId as string).slice(0, 8)}…`
                : '',
            tone: 'neutral',
          };
        case 'edit_listing_as':
          return {
            title: 'Edited listing as partner',
            detail: Array.isArray(p.fieldsUpdated)
              ? (p.fieldsUpdated as unknown[]).join(', ')
              : '',
            tone: 'neutral',
          };
        case 'respond_application_as':
          return {
            title:
              p.decision === 'accept'
                ? 'Accepted application as partner'
                : 'Declined application as partner',
            detail:
              typeof p.contractId === 'string'
                ? `contract ${(p.contractId as string).slice(0, 8)}…`
                : '',
            tone: p.decision === 'accept' ? 'positive' : 'warning',
          };
        case 'publish_listing_as':
          return {
            title: 'Published listing as partner',
            detail:
              typeof p.roomCount === 'number'
                ? `${p.roomCount} room(s), ${p.totalBeds ?? '?'} bed(s)`
                : '',
            tone: 'positive',
          };
        case 'upload_photo_as':
          return {
            title: 'Uploaded listing photo as partner',
            detail:
              typeof p.propertyId === 'string'
                ? `property ${(p.propertyId as string).slice(0, 8)}…`
                : '',
            tone: 'neutral',
          };
        default:
          return {
            title: 'Sent partner notification',
            detail: typeof p.title === 'string' ? (p.title as string) : '',
            tone: 'neutral',
          };
      }
    default:
      return { title: entry.action, detail: '', tone: 'neutral' };
  }
}
