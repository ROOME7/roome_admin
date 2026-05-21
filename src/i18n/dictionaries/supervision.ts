// supervision strings — see common.ts for the pattern. Filled during migration.
const it = {
  title: 'Supervisione e approvazione',
  subtitle:
    'Aziende registrate come Proprietari B2B. Approvale per saltare l\'abbonamento annuale da €150 e abilitare la pubblicazione degli annunci.',
  emptyPending: 'Nessuna richiesta in attesa. Non c\'è nulla che richieda la tua attenzione.',
  emptyApproved: 'Nessuna richiesta approvata.',
  emptyRejected: 'Nessuna richiesta rifiutata.',
  emptyAll: 'Non sono ancora state inviate richieste B2B.',
  submittedOn: 'Inviata il {date}',
  reviewedOn: '· Revisionata il {date}',
  fieldPhone: 'Telefono',
  fieldOwnerUid: 'UID Proprietario',
  rejectionReason: 'Motivo del rifiuto',
  notes: 'Note',
  filterAriaLabel: 'Filtri richieste B2B',
  approveBtn: 'Approva',
  rejectBtn: 'Rifiuta',
  approveTitle: 'Approvare questa azienda?',
  rejectTitle: 'Rifiutare questa azienda?',
  approveIntro:
    '{companyName} verrà contrassegnata come Proprietario B2B approvato. Potrà pubblicare annunci immediatamente e non le verrà addebitato l\'abbonamento annuale da €150.',
  rejectIntro:
    'La richiesta B2B di {companyName} verrà rifiutata. Inserisci un motivo — il Proprietario lo visualizzerà ed è necessario per la conformità.',
  internalNote: 'Nota interna (facoltativa)',
  reasonForRejection: 'Motivo del rifiuto',
  notePlaceholder: 'Eventuali informazioni da annotare…',
  reasonPlaceholder: 'Perché questa azienda viene rifiutata?',
  working: 'Elaborazione…',
};

const en: Record<keyof typeof it, string> = {
  title: 'Supervision & Approval',
  subtitle:
    'Companies that registered as B2B. Approve them to skip the €150 subscription and unlock listing creation.',
  emptyPending: 'No pending applications. Nothing waiting on you right now.',
  emptyApproved: 'No approved applications yet.',
  emptyRejected: 'No rejected applications.',
  emptyAll: 'No B2B applications have been submitted yet.',
  submittedOn: 'Submitted {date}',
  reviewedOn: '· Reviewed {date}',
  fieldPhone: 'Phone',
  fieldOwnerUid: 'Owner UID',
  rejectionReason: 'Rejection reason',
  notes: 'Notes',
  filterAriaLabel: 'B2B request filters',
  approveBtn: 'Approve',
  rejectBtn: 'Reject',
  approveTitle: 'Approve this company?',
  rejectTitle: 'Reject this company?',
  approveIntro:
    'This will mark {companyName} as an approved B2B owner. They\'ll be able to publish listings immediately and won\'t be charged the €150 annual subscription.',
  rejectIntro:
    'This will reject {companyName}\'s B2B application. Please record a reason — the owner sees it and we may need it for compliance.',
  internalNote: 'Internal note (optional)',
  reasonForRejection: 'Reason for rejection',
  notePlaceholder: 'Any context worth recording…',
  reasonPlaceholder: 'Why is this company being rejected?',
  working: 'Working…',
};

export const supervision = { it, en };
