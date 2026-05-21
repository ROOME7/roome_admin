// finances strings — see common.ts for the pattern.
const it = {
  title: 'Finanze',
  subtitle:
    'Guadagni di Roome — abbonamenti dei proprietari e commissioni sul servizio di affitto, letti direttamente dal registro del saldo Stripe.',
  errorLoad: 'Impossibile caricare i dati finanziari da Stripe.',
  truncatedWarning:
    'Il registro dell\'anno in corso ha superato il limite di recupero — i valori seguenti potrebbero essere incompleti. Valutare un consolidamento notturno.',

  // Headline cards
  headlineNetEarnings: 'Guadagni netti',
  headlineNetEarningsHint: 'La nostra quota al netto delle commissioni Stripe',
  headlineGrossCut: 'Quota lorda',
  headlineGrossCutHint: 'Prima delle commissioni di elaborazione Stripe',
  headlineVolume: 'Volume elaborato',
  headlineVolumeHint: 'Ogni euro transitato attraverso Roome',
  headlineLandlordPayouts: 'Versato ai proprietari',
  headlineLandlordPayoutsHint: 'Affitti instradati verso gli account Connect',
  thisMonthHint: 'Questo mese · {hint}',
  yearToDate: 'anno in corso',

  // Reconciliation note
  reconcileNote:
    'I valori si riconciliano con il registro del saldo Stripe. Guadagni netti = quota lorda − commissioni Stripe ({stripeFees} YTD) − rimborsi ({refunds} YTD).',

  // Chart titles
  chartNetByDay: 'Guadagni netti per giorno',
  chartNetByMonth: 'Guadagni netti per mese',
  noEarnings: 'Nessun guadagno registrato.',

  // Source breakdown
  thisMonth: 'Questo mese',
  thisYear: 'Quest\'anno',
  sourceOwnerSub: 'Abbonamenti proprietari',
  sourceRentFees: 'Commissioni sul servizio di affitto',
  sourceNetEarnings: 'Guadagni netti',
  sourcePayment: '{count} pagamento',
  sourcePayments: '{count} pagamenti',
  sourceBilled: '{amount} fatturati',
  sourceRentProcessed: '{amount} affitto elaborato',
  sourceEarned: 'guadagnati',
  sourceInFees: 'in commissioni',

  // Payments trail
  paymentsTitle: 'Pagamenti — chi ha pagato cosa',
  paymentsThisYear: '{count} quest\'anno',
  paymentsShowing: 'mostra {shown}',
  paymentsEmpty: 'Nessun pagamento registrato quest\'anno.',
  colDate: 'Data',
  colPayer: 'Pagante',
  colType: 'Tipo',
  colAmountPaid: 'Importo pagato',
  colRoomeCut: 'Quota Roome',
  badgeSubscription: 'Abbonamento',
  badgeRent: 'Affitto',
  badgeOther: 'Altro',
  unknownPayer: 'Pagante sconosciuto',

  // Footer
  generated: 'Generato il {datetime} · dati live da Stripe ad ogni caricamento.',
};

const en: Record<keyof typeof it, string> = {
  title: 'Finances',
  subtitle:
    "Roome's earnings — owner subscriptions and rent service fees, read straight from the Stripe balance ledger.",
  errorLoad: "Couldn't load financial data from Stripe.",
  truncatedWarning:
    'The year-to-date ledger exceeded the fetch limit — figures below may be incomplete. Consider a nightly rollup.',

  headlineNetEarnings: 'Net earnings',
  headlineNetEarningsHint: 'Our cut after Stripe fees',
  headlineGrossCut: 'Gross cut',
  headlineGrossCutHint: 'Before Stripe processing fees',
  headlineVolume: 'Volume processed',
  headlineVolumeHint: 'Every euro that moved through Roome',
  headlineLandlordPayouts: 'Paid out to landlords',
  headlineLandlordPayoutsHint: 'Rent routed on to Connect accounts',
  thisMonthHint: 'This month · {hint}',
  yearToDate: 'year to date',

  reconcileNote:
    "Figures reconcile with the Stripe balance ledger. Net earnings = gross cut − Stripe fees ({stripeFees} YTD) − refunds ({refunds} YTD).",

  chartNetByDay: 'Net earnings by day',
  chartNetByMonth: 'Net earnings by month',
  noEarnings: 'No earnings recorded yet.',

  thisMonth: 'This month',
  thisYear: 'This year',
  sourceOwnerSub: 'Owner subscriptions',
  sourceRentFees: 'Rent service fees',
  sourceNetEarnings: 'Net earnings',
  sourcePayment: '{count} payment',
  sourcePayments: '{count} payments',
  sourceBilled: '{amount} billed',
  sourceRentProcessed: '{amount} rent processed',
  sourceEarned: 'earned',
  sourceInFees: 'in fees',

  paymentsTitle: 'Payments — who paid what',
  paymentsThisYear: '{count} this year',
  paymentsShowing: '· showing {shown}',
  paymentsEmpty: 'No payments recorded this year yet.',
  colDate: 'Date',
  colPayer: 'Payer',
  colType: 'Type',
  colAmountPaid: 'Amount paid',
  colRoomeCut: "Roome's cut",
  badgeSubscription: 'Subscription',
  badgeRent: 'Rent',
  badgeOther: 'Other',
  unknownPayer: 'Unknown payer',

  generated: 'Generated {datetime} · live from Stripe on every load.',
};

export const finances = { it, en };
