// Strings for the Active Management (/managed) section.
// See common.ts for the PATTERN. Keys that live in common.* are NOT repeated here.

// ---------------------------------------------------------------------------
// page.tsx — ManagedPage, EmptyState, AccountCard, OperateLink, Field
// ---------------------------------------------------------------------------
const it = {
  // Page header
  pageTitle: 'Gestione attiva',
  pageSubtitle:
    'Account che gestisci per conto di partner selezionati. Creane di nuovi e restituiscili quando il partner è pronto ad agire in autonomia.',

  // Empty states
  emptyFiltered:
    'Nessun account corrisponde ai filtri attivi. Cancella la ricerca e i chip per vedere tutto in questo stato.',
  emptyActive:
    'Nessun account gestito. Usa "Crea account gestito" per iniziare.',
  emptySuspended: 'Nessun account è attualmente sospeso.',
  emptyHandedOver: 'Nessun account è stato ancora passato.',
  emptyArchived: 'Nessun account archiviato in archivio.',
  emptyAll: 'Nessun account gestito ancora presente.',

  // AccountCard field labels
  fieldDisplayName: 'Nome visualizzato',
  fieldVat: 'VAT (Partita IVA)',
  fieldPec: 'PEC',
  fieldPhone: 'Telefono',
  fieldUid: 'UID',
  fieldManagedSince: 'Gestito dal',
  fieldHandedOver: 'Passato il',
  noEmail: '(nessuna email)',

  // Waiver badge tooltip
  waiverActive: 'Esenzione attiva',

  // Suspension / archive banners on card
  suspensionReasonLabel: 'Motivo della sospensione:',
  archiveReasonLabel: 'Motivo dell\'archiviazione:',

  // OperateLink
  operate: 'Gestisci',

  // ---------------------------------------------------------------------------
  // filter-tabs.tsx
  // ---------------------------------------------------------------------------
  tabManaged: 'Gestiti',
  tabSuspended: 'Sospesi',
  tabHandedOver: 'Passati',
  tabArchived: 'Archiviati',
  tabAll: 'Tutti',
  filterTabsAriaLabel: 'Filtri account gestiti',

  // ---------------------------------------------------------------------------
  // search-input.tsx
  // ---------------------------------------------------------------------------
  searchPlaceholder: 'Cerca email, VAT, azienda…',

  // ---------------------------------------------------------------------------
  // secondary-filters.tsx
  // ---------------------------------------------------------------------------
  ownerTypeAll: 'Tutti i tipi',
  ownerTypePrivate: 'Privato',
  ownerTypeInstitutional: 'Istituzionale',
  ownerAny: 'Qualsiasi admin',
  ownerMine: 'Gestiti da me',

  // ---------------------------------------------------------------------------
  // status-badge.tsx
  // ---------------------------------------------------------------------------
  statusManaged: 'Gestito',
  statusHandedOver: 'Passato',
  ownerTypeBadgePrivate: 'Privato',
  ownerTypeBadgeInstitutional: 'Istituzionale',

  // ---------------------------------------------------------------------------
  // create-managed-account.tsx
  // ---------------------------------------------------------------------------
  createButton: 'Crea account gestito',
  createDialogTitle: 'Crea account gestito',
  createDialogSubtitle:
    'Gestirai questo account per conto del partner. Una password casuale viene impostata in automatico; il partner riceverà una email di reimpostazione password quando effettuerai il passaggio.',
  createSubmit: 'Crea account',
  createSubmitting: 'Creazione…',
  fieldEmail: 'Email',
  fieldEmailPlaceholder: 'proprietario@esempio.it',
  fieldDisplayNameLabel: 'Nome visualizzato',
  fieldDisplayNamePlaceholder: 'Nome pubblico mostrato agli inquilini',
  fieldOwnerType: 'Tipo di proprietario',
  ownerTypePrivateRadio: 'Privato (B2C)',
  ownerTypeInstitutionalRadio: 'Istituzionale (B2B)',
  fieldFullName: 'Nome completo (legale)',
  fieldFullNamePlaceholder: 'Nome legale sul contratto',
  fieldCompanyName: 'Ragione sociale',
  fieldVatNumber: 'Partita IVA',
  fieldVatHint: '11 cifre',
  fieldPecHint: 'Email certificata (facoltativa)',
  fieldPhoneNumber: 'Numero di telefono',
  fieldPhoneHint: 'Facoltativo',
  fieldPhonePlaceholder: '+39 …',
  fieldInternalNote: 'Nota interna',
  fieldInternalNoteHint: 'Facoltativo, visibile solo agli amministratori',

  // ---------------------------------------------------------------------------
  // edit-managed-account.tsx
  // ---------------------------------------------------------------------------
  editButton: 'Modifica',
  editDialogTitle: 'Modifica account gestito',
  editDialogSubtitle:
    'Aggiorna i dati del partner. L\'email non può essere modificata qui — contatta il team tecnico se il partner ha bisogno di un nuovo indirizzo di accesso.',
  editEmailHint: 'Sola lettura in v1',
  editSaveChanges: 'Salva modifiche',
  editSaving: 'Salvataggio…',

  // ---------------------------------------------------------------------------
  // notes-dialog.tsx
  // ---------------------------------------------------------------------------
  notesButton: 'Note',
  notesDialogTitle: 'Note interne',
  notesDialogSubtitle:
    'Visibili solo agli amministratori di Roome. Sopravvivono al passaggio e all\'archiviazione.',
  notesFieldLabel: 'Nota',
  notesPlaceholder: 'Qualcosa che vale la pena registrare…',
  notesLastEdited: 'Ultima modifica {date}',
  notesSaving: 'Salvataggio…',

  // ---------------------------------------------------------------------------
  // tags-dialog.tsx
  // ---------------------------------------------------------------------------
  tagsButton: 'Tag',
  tagsDialogTitle: 'Tag',
  tagsDialogSubtitle:
    'Categorizza questo account per filtrare e generare report. Visibili solo agli amministratori.',
  tagsInputPlaceholder: 'Scrivi un tag e premi Invio…',
  tagsSuggested: 'Suggeriti:',
  tagsRemoveAriaLabel: 'Rimuovi {tag}',
  tagsSave: 'Salva tag',
  tagsSaving: 'Salvataggio…',
  tagsInvalidError:
    '"{tag}" non è valido — usa lettere minuscole, cifre e trattini (1–40 caratteri).',
  tagsMaxError: 'Massimo {max} tag per account.',

  // ---------------------------------------------------------------------------
  // handover-dialog.tsx
  // ---------------------------------------------------------------------------
  handoverButton: 'Passa',
  handoverDialogTitleConfirm: 'Passare {name}?',
  handoverDialogTitleDone: 'Passaggio completato',
  handoverSubtitle:
    'Non gestirai più questo account. Verrà inviata al partner un\'email con un link per reimpostare la password, così potrà impostarne una propria e accedere direttamente.',
  handoverCheck1ManagedBy: 'Il campo managedBy viene cancellato sull\'account',
  handoverCheck2AuditTrail: 'Il tracciato di audit (managementHandedOverAt + managementHandedOverByAdminUid) viene preservato',
  handoverCheck3Email: 'L\'email di reimpostazione password viene inviata all\'indirizzo registrato del partner',
  handoverConfirmButton: 'Conferma passaggio',
  handoverConfirming: 'Passaggio in corso…',
  handoverDoneButton: 'Fine',
  handoverSuccessMessage:
    'Account rilasciato e email di reimpostazione password inviata. Il partner può ora accedere dopo aver impostato la propria password.',
  handoverEmailFailedMessage:
    'Account rilasciato. L\'email di reimpostazione password non è stata inviata — chiedi al partner di usare il flusso "Password dimenticata" sull\'app/sito, oppure riprova dalla Console Firebase → Authentication.',

  // ---------------------------------------------------------------------------
  // lifecycle-dialogs.tsx — Suspend
  // ---------------------------------------------------------------------------
  suspendButton: 'Sospendi',
  suspendDialogTitle: 'Sospendi account',
  suspendDialogSubtitle:
    '{name} non potrà più accedere; ogni annuncio pubblicamente attivo sarà messo in pausa con motivazione admin_suspended. Reversibile tramite Riattiva.',
  suspendReasonPlaceholder:
    'Perché stai sospendendo questo account? Visibile solo agli amministratori.',
  suspendSubmit: 'Sospendi',
  suspendSubmitting: 'Sospensione…',

  // lifecycle-dialogs.tsx — Reactivate
  reactivateButton: 'Riattiva',
  reactivateDialogTitle: 'Riattivare l\'account?',
  reactivateDialogSubtitle:
    '{name} potrà di nuovo accedere. Gli annunci messi in pausa dalla sospensione originale verranno ripristinati su active.',
  reactivateOriginalReason: 'Motivo originale:',
  reactivateSuccess: 'Riattivato. {count} annuncio/i ripristinato/i.',
  reactivateSubmit: 'Riattiva',
  reactivateSubmitting: 'Riattivazione…',

  // lifecycle-dialogs.tsx — Archive
  archiveButton: 'Archivia',
  archiveDialogTitle: 'Archivia account',
  archiveDialogSubtitle:
    'Soft-delete di {name}: disabilita l\'accesso, archivia ogni annuncio e imposta deletedAt sul documento utente. Le letture dall\'app Flutter verranno bloccate. Non è una cancellazione definitiva — i dati sono conservati per audit / diritto all\'oblio GDPR.',
  archiveReasonPlaceholder: 'Perché stai archiviando questo account?',
  archiveConfirmLabel: 'Digita "{phrase}" per confermare',
  archiveSubmit: 'Archivia account',
  archiveSubmitting: 'Archiviazione…',
  archiveSuccessListings: 'Archiviato. {count} annuncio/i contrassegnato/i come archiviato/i.',
  archiveSuccessSubscription: 'Abbonamento Stripe cancellato automaticamente.',
  archiveSubscriptionCancelFailed:
    'Cancellazione abbonamento Stripe non riuscita: {error}. Cancella manualmente nel Pannello Stripe.',

  // lifecycle-dialogs.tsx — Reclaim
  reclaimButton: 'Riprendi',
  reclaimDialogTitle: 'Riprendere la gestione?',
  reclaimDialogSubtitle:
    'Riprenderai il controllo operativo di {name}. Il partner può ancora accedere con la password attuale, ma l\'account tornerà a essere mostrato come Gestito.',
  reclaimBullet1:
    'L\'esenzione dall\'abbonamento €150/anno si riattiva durante la gestione.',
  reclaimBullet2:
    'Eventuali abbonamenti Stripe attivi del partner non vengono cancellati.',
  reclaimBullet3: 'Lo stato di approvazione B2B rimane invariato.',
  reclaimSubmit: 'Riprendi',
  reclaimSubmitting: 'Ripresa in corso…',

  // ---------------------------------------------------------------------------
  // admin-power-dialogs.tsx — Waiver
  // ---------------------------------------------------------------------------
  waiverButton: 'Esenzione',
  waiverDialogTitle: 'Esenzione abbonamento',
  waiverDialogSubtitle:
    'Bypassa il gate dell\'abbonamento proprietario €150/anno indipendentemente dallo stato gestito/passato. Usare per i partner strategici che mantengono l\'account dopo il passaggio ma non devono essere addebitati.',
  waiverActive_label: 'Esenzione attiva',
  waiverReasonLabel: 'Motivo',
  waiverReasonPlaceholder: 'Perché questo partner ha un\'esenzione?',

  // admin-power-dialogs.tsx — Connect
  connectButton: 'Connect',
  connectDialogTitle: 'Onboarding Stripe Connect',
  connectDialogSubtitle:
    'Genera un nuovo Stripe Account Link per {name} e lo invia tramite FCM + documento notifiche. Il link è monouso e ha breve scadenza; puoi inviarlo di nuovo in qualsiasi momento. La creazione di un Express account è idempotente.',
  connectExistingAccountId: 'ID account esistente:',
  connectNoneYet: '(nessuno ancora — verrà creato)',
  connectSuccessMessage:
    'Link di onboarding generato e inviato al partner.',
  connectDirectUrlLabel: 'URL diretto (da condividere manualmente se necessario):',
  connectAcctLabel: 'acct:',
  connectGenerate: 'Genera link e notifica',
  connectGenerating: 'Generazione…',

  // admin-power-dialogs.tsx — Notify
  notifyButton: 'Notifica',
  notifyDialogTitle: 'Invia notifica al partner',
  notifyDialogSubtitle:
    'Scrive un documento in notifications/ e invia nel limite del possibile un push tramite FCM. Usare con parsimonia — i partner si aspettano notifiche limitate.',
  notifyTitleLabel: 'Titolo',
  notifyTitleHint: '{count} / 60',
  notifyBodyLabel: 'Corpo',
  notifyBodyHint: '{count} / 240',
  notifyBodyPlaceholder: 'Messaggio breve — max 240 caratteri.',
  notifyDeepLinkLabel: 'Deep link',
  notifyDeepLinkHint: 'URL in-app facoltativo',
  notifySuccessDelivered: 'Inviato al dispositivo del partner.',
  notifySuccessNoToken:
    'Documento notifica scritto, ma nessun token FCM registrato — il partner lo vedrà al prossimo accesso.',
  notifySend: 'Invia',
  notifySending: 'Invio…',

  // admin-power-dialogs.tsx — Refunds
  refundsButton: 'Rimborsi',
  refundsDialogTitle: 'Rimborsi abbonamento proprietario',
  refundsDialogSubtitle:
    'Elenca le fatture €150/anno del partner da Stripe. Rimborsa parzialmente o per intero ogni fattura. I rimborsi sui pagamenti degli affitti NON sono mostrati qui — avvengono sull\'Account Connesso del partner.',
  refundsLoadingInvoices: 'Caricamento fatture…',
  refundsNoInvoices:
    'Nessuna fattura abbonamento proprietario trovata. (Il partner potrebbe non avere un record cliente Stripe, o non aver ancora pagato l\'abbonamento.)',
  refundPaid: '€{amount} pagato',
  refundRefunded: '€{amount} rimborsato',
  refundButton: 'Rimborsa',

  // admin-power-dialogs.tsx — RefundInvoiceDialog
  refundInvoiceDialogTitle: 'Rimborsa fattura',
  refundInvoiceSubtitle: 'Fattura {number}. Fino a €{max} rimborsabile.',
  refundFullLabel: 'Rimborsa l\'intero importo rimanente (€{amount})',
  refundPartialLabel: 'Rimborsa importo parziale',
  refundAmountLabel: 'Importo (EUR)',
  refundReasonLabel: 'Motivo',
  refundReasonPlaceholder: 'Nota interna — visibile solo agli amministratori.',
  refundPartialError: 'L\'importo parziale deve essere 0,01..{max} EUR.',
  refundSubmit: 'Rimborsa',
  refundSubmitting: 'Rimborso in corso…',

  // ---------------------------------------------------------------------------
  // activity-dialog.tsx
  // ---------------------------------------------------------------------------
  activityButton: 'Attività',
  activityDialogTitle: 'Attività · {name}',
  activityDialogSubtitle:
    'Ultime 50 azioni admin su questo account. Stessa fonte del feed attività recenti nella dashboard.',
  activityEmpty: 'Nessuna azione admin registrata per questo account.',
  activityBy: 'di {uid}',
};

const en: Record<keyof typeof it, string> = {
  // Page header
  pageTitle: 'Active Management',
  pageSubtitle:
    'Accounts you operate on behalf of select partners. Create new ones, hand them back when the partner is ready to self-serve.',

  // Empty states
  emptyFiltered:
    'No accounts match the current filters. Clear search and chips to see everything in this status.',
  emptyActive: 'No managed accounts yet. Use "Create managed account" above to set one up.',
  emptySuspended: 'No accounts are currently suspended.',
  emptyHandedOver: 'No accounts have been handed over yet.',
  emptyArchived: 'No archived accounts on record.',
  emptyAll: 'No managed accounts on record yet.',

  // AccountCard field labels
  fieldDisplayName: 'Display name',
  fieldVat: 'VAT (Partita IVA)',
  fieldPec: 'PEC',
  fieldPhone: 'Phone',
  fieldUid: 'UID',
  fieldManagedSince: 'Managed since',
  fieldHandedOver: 'Handed over',
  noEmail: '(no email)',

  // Waiver badge tooltip
  waiverActive: 'Waiver active',

  // Suspension / archive banners on card
  suspensionReasonLabel: 'Suspension reason:',
  archiveReasonLabel: 'Archive reason:',

  // OperateLink
  operate: 'Operate',

  // ---------------------------------------------------------------------------
  // filter-tabs.tsx
  // ---------------------------------------------------------------------------
  tabManaged: 'Managed',
  tabSuspended: 'Suspended',
  tabHandedOver: 'Handed over',
  tabArchived: 'Archived',
  tabAll: 'All',
  filterTabsAriaLabel: 'Managed account filters',

  // ---------------------------------------------------------------------------
  // search-input.tsx
  // ---------------------------------------------------------------------------
  searchPlaceholder: 'Search email, VAT, company…',

  // ---------------------------------------------------------------------------
  // secondary-filters.tsx
  // ---------------------------------------------------------------------------
  ownerTypeAll: 'All types',
  ownerTypePrivate: 'Private',
  ownerTypeInstitutional: 'Institutional',
  ownerAny: 'Any admin',
  ownerMine: 'Managed by me',

  // ---------------------------------------------------------------------------
  // status-badge.tsx
  // ---------------------------------------------------------------------------
  statusManaged: 'Managed',
  statusHandedOver: 'Handed over',
  ownerTypeBadgePrivate: 'Private',
  ownerTypeBadgeInstitutional: 'Institutional',

  // ---------------------------------------------------------------------------
  // create-managed-account.tsx
  // ---------------------------------------------------------------------------
  createButton: 'Create managed account',
  createDialogTitle: 'Create managed account',
  createDialogSubtitle:
    "You'll operate this account on the partner's behalf. A random password is set under the hood; the partner gets a password-reset email when you hand over.",
  createSubmit: 'Create account',
  createSubmitting: 'Creating…',
  fieldEmail: 'Email',
  fieldEmailPlaceholder: 'owner@example.it',
  fieldDisplayNameLabel: 'Display name',
  fieldDisplayNamePlaceholder: 'Public name shown to tenants',
  fieldOwnerType: 'Owner type',
  ownerTypePrivateRadio: 'Private (B2C)',
  ownerTypeInstitutionalRadio: 'Institutional (B2B)',
  fieldFullName: 'Full name (legal)',
  fieldFullNamePlaceholder: 'Legal name on the contract',
  fieldCompanyName: 'Company name',
  fieldVatNumber: 'VAT number (Partita IVA)',
  fieldVatHint: '11 digits',
  fieldPecHint: 'Optional certified email',
  fieldPhoneNumber: 'Phone number',
  fieldPhoneHint: 'Optional',
  fieldPhonePlaceholder: '+39 …',
  fieldInternalNote: 'Internal note',
  fieldInternalNoteHint: 'Optional, only admins see this',

  // ---------------------------------------------------------------------------
  // edit-managed-account.tsx
  // ---------------------------------------------------------------------------
  editButton: 'Edit',
  editDialogTitle: 'Edit managed account',
  editDialogSubtitle:
    "Update the partner's details. Email cannot be changed here — contact engineering if a partner needs a new sign-in address.",
  editEmailHint: 'Read-only in v1',
  editSaveChanges: 'Save changes',
  editSaving: 'Saving…',

  // ---------------------------------------------------------------------------
  // notes-dialog.tsx
  // ---------------------------------------------------------------------------
  notesButton: 'Notes',
  notesDialogTitle: 'Internal notes',
  notesDialogSubtitle: 'Visible only to Roome admins. Survives handover and archival.',
  notesFieldLabel: 'Note',
  notesPlaceholder: 'Anything worth recording…',
  notesLastEdited: 'Last edited {date}',
  notesSaving: 'Saving…',

  // ---------------------------------------------------------------------------
  // tags-dialog.tsx
  // ---------------------------------------------------------------------------
  tagsButton: 'Tags',
  tagsDialogTitle: 'Tags',
  tagsDialogSubtitle:
    'Categorize this account for filtering and reporting. Visible only to admins.',
  tagsInputPlaceholder: 'Type a tag and press Enter…',
  tagsSuggested: 'Suggested:',
  tagsRemoveAriaLabel: 'Remove {tag}',
  tagsSave: 'Save tags',
  tagsSaving: 'Saving…',
  tagsInvalidError:
    '"{tag}" is invalid — use lowercase letters, digits, dashes (1–40 chars).',
  tagsMaxError: 'Max {max} tags per account.',

  // ---------------------------------------------------------------------------
  // handover-dialog.tsx
  // ---------------------------------------------------------------------------
  handoverButton: 'Hand over',
  handoverDialogTitleConfirm: 'Hand over {name}?',
  handoverDialogTitleDone: 'Hand-over complete',
  handoverSubtitle:
    "You'll no longer manage this account. We'll email the partner a password-reset link so they can set their own password and sign in directly.",
  handoverCheck1ManagedBy: 'managedBy is cleared on the account',
  handoverCheck2AuditTrail:
    'Audit trail (managementHandedOverAt + managementHandedOverByAdminUid) is preserved',
  handoverCheck3Email: "Password-reset email goes to the partner's registered address",
  handoverConfirmButton: 'Confirm hand-over',
  handoverConfirming: 'Handing over…',
  handoverDoneButton: 'Done',
  handoverSuccessMessage:
    'Account released and password-reset email sent. The partner can now sign in after setting their own password.',
  handoverEmailFailedMessage:
    'Account released. The password-reset email did not go out — ask the partner to use the "Forgot password" flow on the app/site, or retry from Firebase Console → Authentication.',

  // ---------------------------------------------------------------------------
  // lifecycle-dialogs.tsx — Suspend
  // ---------------------------------------------------------------------------
  suspendButton: 'Suspend',
  suspendDialogTitle: 'Suspend account',
  suspendDialogSubtitle:
    '{name} will be blocked from signing in, and every currently-public listing they own will be paused with reason admin_suspended. Reversible via Reactivate.',
  suspendReasonPlaceholder:
    'Why are you suspending this account? Visible only to admins.',
  suspendSubmit: 'Suspend',
  suspendSubmitting: 'Suspending…',

  // lifecycle-dialogs.tsx — Reactivate
  reactivateButton: 'Reactivate',
  reactivateDialogTitle: 'Reactivate account?',
  reactivateDialogSubtitle:
    '{name} will be able to sign in again. Any listings paused by the original suspension will be restored to active.',
  reactivateOriginalReason: 'Original reason:',
  reactivateSuccess: 'Reactivated. {count} listing(s) restored.',
  reactivateSubmit: 'Reactivate',
  reactivateSubmitting: 'Reactivating…',

  // lifecycle-dialogs.tsx — Archive
  archiveButton: 'Archive',
  archiveDialogTitle: 'Archive account',
  archiveDialogSubtitle:
    'Soft-deletes {name}: disables sign-in, archives every listing they own, and stamps deletedAt on the user doc. Reads from the Flutter app will be blocked. This is not a hard delete — data is retained for audit / GDPR-right-to-be-forgotten.',
  archiveReasonPlaceholder: 'Why are you archiving this account?',
  archiveConfirmLabel: 'Type "{phrase}" to confirm',
  archiveSubmit: 'Archive account',
  archiveSubmitting: 'Archiving…',
  archiveSuccessListings: 'Archived. {count} listing(s) marked archived.',
  archiveSuccessSubscription: 'Stripe subscription cancelled automatically.',
  archiveSubscriptionCancelFailed:
    'Stripe subscription cancel failed: {error}. Cancel manually in the Stripe Dashboard.',

  // lifecycle-dialogs.tsx — Reclaim
  reclaimButton: 'Reclaim',
  reclaimDialogTitle: 'Reclaim management?',
  reclaimDialogSubtitle:
    "You'll re-take operational control of {name}. The partner can still sign in with their existing password, but the account will once again show as Managed.",
  reclaimBullet1: 'The €150/yr subscription waiver re-activates while managed.',
  reclaimBullet2:
    'Any active Stripe subscription the partner currently has is not cancelled.',
  reclaimBullet3: 'B2B approval state is unchanged.',
  reclaimSubmit: 'Reclaim',
  reclaimSubmitting: 'Reclaiming…',

  // ---------------------------------------------------------------------------
  // admin-power-dialogs.tsx — Waiver
  // ---------------------------------------------------------------------------
  waiverButton: 'Waiver',
  waiverDialogTitle: 'Subscription waiver',
  waiverDialogSubtitle:
    'Bypasses the €150/yr owner-subscription gate independently of managed/handed-over state. Use for strategic partners who keep their account post-handover but shouldn\'t be charged.',
  waiverActive_label: 'Waiver active',
  waiverReasonLabel: 'Reason',
  waiverReasonPlaceholder: 'Why does this partner get a waiver?',

  // admin-power-dialogs.tsx — Connect
  connectButton: 'Connect',
  connectDialogTitle: 'Stripe Connect onboarding',
  connectDialogSubtitle:
    'Generates a fresh Stripe Account Link for {name} and pushes it to them via FCM + notifications doc. The link is single-use and short-lived; resend any time. Creating an Express account is idempotent.',
  connectExistingAccountId: 'Existing account ID:',
  connectNoneYet: '(none yet — will create)',
  connectSuccessMessage: 'Onboarding link generated and pushed to the partner.',
  connectDirectUrlLabel: 'Direct URL (also share manually if needed):',
  connectAcctLabel: 'acct:',
  connectGenerate: 'Generate link & notify',
  connectGenerating: 'Generating…',

  // admin-power-dialogs.tsx — Notify
  notifyButton: 'Notify',
  notifyDialogTitle: 'Send partner notification',
  notifyDialogSubtitle:
    'Writes a doc to notifications/ and best-effort delivers a push via FCM. Use sparingly — partners have FCM-quieting expectations.',
  notifyTitleLabel: 'Title',
  notifyTitleHint: '{count} / 60',
  notifyBodyLabel: 'Body',
  notifyBodyHint: '{count} / 240',
  notifyBodyPlaceholder: 'Short message — under 240 chars.',
  notifyDeepLinkLabel: 'Deep link',
  notifyDeepLinkHint: 'Optional in-app URL',
  notifySuccessDelivered: "Pushed to the partner's device.",
  notifySuccessNoToken:
    'Notification doc written, but no FCM token on file — partner will see it next time they sign in.',
  notifySend: 'Send',
  notifySending: 'Sending…',

  // admin-power-dialogs.tsx — Refunds
  refundsButton: 'Refunds',
  refundsDialogTitle: 'Owner subscription refunds',
  refundsDialogSubtitle:
    "Lists this partner's €150/yr invoices from Stripe. Refund partially or in full per invoice. Rent-payment refunds are NOT shown here — those happen on the partner's Connected Account.",
  refundsLoadingInvoices: 'Loading invoices…',
  refundsNoInvoices:
    "No owner-subscription invoices found. (Partner may not have a Stripe customer record, or hasn't paid the subscription yet.)",
  refundPaid: '€{amount} paid',
  refundRefunded: '€{amount} refunded',
  refundButton: 'Refund',

  // admin-power-dialogs.tsx — RefundInvoiceDialog
  refundInvoiceDialogTitle: 'Refund invoice',
  refundInvoiceSubtitle: 'Invoice {number}. Up to €{max} refundable.',
  refundFullLabel: 'Refund full remaining (€{amount})',
  refundPartialLabel: 'Refund partial amount',
  refundAmountLabel: 'Amount (EUR)',
  refundReasonLabel: 'Reason',
  refundReasonPlaceholder: 'Internal note — visible only to admins.',
  refundPartialError: 'Partial amount must be 0.01..{max} EUR.',
  refundSubmit: 'Refund',
  refundSubmitting: 'Refunding…',

  // ---------------------------------------------------------------------------
  // activity-dialog.tsx
  // ---------------------------------------------------------------------------
  activityButton: 'Activity',
  activityDialogTitle: 'Activity · {name}',
  activityDialogSubtitle:
    'Last 50 admin actions targeting this account. Same source as the dashboard recent-activity feed.',
  activityEmpty: 'No admin actions recorded for this account yet.',
  activityBy: 'by {uid}',
};

export const managed = { it, en };
