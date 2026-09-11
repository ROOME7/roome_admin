// Users-section strings — list page and detail page.
// See common.ts for the pattern: define `it` fully, then type `en` as
// Record<keyof typeof it, string> so a missing key is a compile error.
//
// ⚠️ THE DETAIL PAGE NOW READS ONE API RECORD, NOT FIVE FIRESTORE DOCUMENTS.
// The strings that described that shape are gone with it: `docNotExist` had
// nothing left to say, and "raw documents" became one record.

const it = {
  // List page — header
  title: 'Utenti',
  subtitle:
    'Tutti gli account sulla piattaforma — inquilini e proprietari di ogni tipo. Apri una riga per vedere il record completo.',

  // List page — search / filter
  searchPlaceholder: 'Cerca nome, email, azienda o UID…',
  tabAll: 'Tutti',
  tabTenants: 'Inquilini',
  tabLandlords: 'Proprietari',
  noSearchResults: 'Nessun utente corrisponde a questa ricerca.',
  noUsersInCategory: 'Nessun utente in questa categoria.',

  // List page — row badges
  badgeManaged: 'Gestito',
  badgeEmailUnverified: 'Email non verificata',
  noEmail: '(nessuna email)',

  // Detail page — back link
  backToUsers: '← Utenti',

  // Detail page — header badges
  badgeManagedAccount: 'Account gestito',
  badgeIdentityVerified: 'Identità verificata',

  // Detail page — section: Identity & contact
  sectionIdentity: 'Identità e contatti',
  fieldFullName: 'Nome completo',
  fieldUsername: 'Nome utente',
  fieldEmail: 'Email',
  fieldEmailVerified: 'Email verificata',
  fieldPhone: 'Telefono',
  fieldBirthDate: 'Data di nascita',

  // Detail page — section: Account
  sectionAccount: 'Account',
  fieldRole: 'Ruolo',
  fieldProfileCompleted: 'Profilo completato',
  fieldCreated: 'Creato',
  fieldLastUpdated: 'Ultimo aggiornamento',
  fieldLastSeen: 'Ultimo accesso',
  fieldAuthProvider: 'Provider di autenticazione',
  fieldLocale: 'Lingua',
  fieldRoleConfirmed: 'Ruolo confermato',

  // Detail page — section: Tenant profile
  sectionTenantProfile: 'Profilo inquilino',
  fieldAge: 'Età',
  fieldGender: 'Genere',
  fieldUniversity: 'Università',
  fieldProfession: 'Professione',
  fieldFieldArea: 'Settore / area',
  fieldCleanliness: 'Ordine e pulizia',
  fieldNoise: 'Rumore',
  fieldSleepSchedule: 'Orari di sonno',
  fieldSociability: 'Socialità',
  fieldGuests: 'Ospiti',
  fieldSmoker: 'Fumatore',
  fieldHasPets: 'Animali domestici',
  fieldCooksOften: 'Cucina spesso',
  fieldBio: 'Biografia',
  fieldBioModerated: 'Biografia moderata il',
  noTenantProfile: 'Questo utente non ha ancora compilato il profilo inquilino.',

  // Detail page — section: Landlord details
  sectionLandlord: 'Dettagli proprietario',
  fieldOwnerType: 'Tipo di proprietario',
  ownerTypeB2b: 'B2B (agenzia / azienda)',
  ownerTypeB2c: 'B2C (privato)',
  fieldCompanyName: 'Ragione sociale',
  fieldVatNumber: 'Partita IVA',
  fieldFiscalCode: 'Codice fiscale',
  fieldAdminName: 'Referente',
  fieldProperties: 'Immobili di proprietà',

  // Detail page — section: B2B application
  sectionB2bRequest: 'Richiesta account B2B',
  fieldTicketRef: 'Riferimento pratica',
  fieldB2bApproval: 'Stato approvazione B2B',
  fieldRequestSubmitted: 'Inviata il',
  fieldReviewedAt: 'Esaminata il',
  fieldNotes: 'Note',

  // Detail page — section: Verification & reputation
  sectionVerification: 'Verifica e reputazione',
  fieldIdentityVerification: 'Verifica identità',
  fieldIdentityVerifiedAt: 'Identità verificata il',
  fieldIdentityFailure: 'Motivo del rifiuto',
  fieldVerifiedTenant: 'Inquilino verificato',
  fieldVerifiedOwner: 'Proprietario verificato',
  fieldReviews: 'Recensioni',
  fieldAverageRating: 'Valutazione media',

  // Detail page — section: Stripe (brand name kept as label only)
  stripeNote:
    'Solo identificativi e stato. I pagamenti si gestiscono dal backend, mai da questo pannello.',
  fieldStripeMode: 'Ambiente',
  fieldCustomerId: 'ID cliente',
  fieldConnectAccountId: 'ID account Connect',
  fieldConnectChargesEnabled: 'Addebiti Connect abilitati',
  fieldConnectPayoutsEnabled: 'Bonifici Connect abilitati',
  fieldConnectDisabledReason: 'Motivo del blocco',
  fieldRequirementsDue: 'Documenti richiesti',
  fieldOwnerSubscription: 'Abbonamento proprietario',
  fieldSubscriptionId: 'ID abbonamento',
  fieldSubscriptionRenews: 'Rinnovo / scadenza',
  fieldSubscriptionWaiver: 'Esenzione attiva',
  noStripe: 'Nessun oggetto Stripe collegato a questo account.',

  // Detail page — section: Activity
  sectionActivity: 'Attività',
  fieldContractsAsTenant: 'Contratti come inquilino',
  fieldContractsAsLandlord: 'Contratti come proprietario',
  fieldReportsAgainst: 'Segnalazioni ricevute',
  fieldReportsMade: 'Segnalazioni inviate',

  // Detail page — section: Legal & consent
  sectionLegal: 'Consensi',
  fieldConsentVersion: 'Versione termini accettata',
  fieldConsentAccepted: 'Accettati il',
  fieldConfirmedAge18: 'Maggiore età confermata',
  fieldMessagingConsent: 'Consenso alla messaggistica',

  // Detail page — section: Account status
  sectionAccountStatus: 'Stato account',
  fieldSuspended: 'Sospeso',
  fieldReason: 'Motivo',
  fieldArchived: 'Archiviato',
  fieldPurgeAt: 'Cancellazione definitiva',

  // Detail page — managed account notice
  managedAccountInfo:
    "Questo account è gestito per conto del partner da un amministratore.",
  openActiveManagement: 'Apri in Gestione Attiva →',

  // Detail page — blocks panel (App Store 1.2 mutual block)
  blocksPanelTitle: 'Blocchi reciproci',
  blocksPanelSubtitle:
    'Account che questo utente ha bloccato e account che hanno bloccato questo utente. Il blocco è reciproco: nessuna delle due parti vede gli annunci, i messaggi o le recensioni dell\'altra.',
  blocksOutgoing: 'Bloccati da questo utente',
  blocksOutgoingEmpty: 'Nessun account bloccato.',
  blocksIncoming: 'Hanno bloccato questo utente',
  blocksIncomingEmpty: 'Nessun account ha bloccato questo utente.',
  blocksTruncated: 'Mostrati i {shown} più recenti su {total}.',

  // Detail page — raw record section
  rawRecord: 'Record completo (JSON)',
  rawRecordNote: 'Esattamente ciò che restituisce GET /admin/users/{id}.',
};

const en: Record<keyof typeof it, string> = {
  title: 'Users',
  subtitle:
    'Every account on the platform — tenants and landlords of all types. Open a row to see the full record.',

  searchPlaceholder: 'Search name, email, company, or UID…',
  tabAll: 'All',
  tabTenants: 'Tenants',
  tabLandlords: 'Landlords',
  noSearchResults: 'No users match that search.',
  noUsersInCategory: 'No users in this category yet.',

  badgeManaged: 'Managed',
  badgeEmailUnverified: 'Email unverified',
  noEmail: '(no email)',

  backToUsers: '← Users',

  badgeManagedAccount: 'Managed account',
  badgeIdentityVerified: 'Identity verified',

  sectionIdentity: 'Identity & contact',
  fieldFullName: 'Full name',
  fieldUsername: 'Username',
  fieldEmail: 'Email',
  fieldEmailVerified: 'Email verified',
  fieldPhone: 'Phone',
  fieldBirthDate: 'Date of birth',

  sectionAccount: 'Account',
  fieldRole: 'Role',
  fieldProfileCompleted: 'Profile completed',
  fieldCreated: 'Created',
  fieldLastUpdated: 'Last updated',
  fieldLastSeen: 'Last seen',
  fieldAuthProvider: 'Auth provider',
  fieldLocale: 'Language',
  fieldRoleConfirmed: 'Role confirmed',

  sectionTenantProfile: 'Tenant profile',
  fieldAge: 'Age',
  fieldGender: 'Gender',
  fieldUniversity: 'University',
  fieldProfession: 'Profession',
  fieldFieldArea: 'Field / area',
  fieldCleanliness: 'Cleanliness',
  fieldNoise: 'Noise',
  fieldSleepSchedule: 'Sleep schedule',
  fieldSociability: 'Sociability',
  fieldGuests: 'Guests',
  fieldSmoker: 'Smoker',
  fieldHasPets: 'Has pets',
  fieldCooksOften: 'Cooks often',
  fieldBio: 'Bio',
  fieldBioModerated: 'Bio moderated on',
  noTenantProfile: 'This user has not filled in a tenant profile yet.',

  sectionLandlord: 'Landlord details',
  fieldOwnerType: 'Owner type',
  ownerTypeB2b: 'B2B (agency / company)',
  ownerTypeB2c: 'B2C (private)',
  fieldCompanyName: 'Company name',
  fieldVatNumber: 'VAT number',
  fieldFiscalCode: 'Fiscal code',
  fieldAdminName: 'Contact person',
  fieldProperties: 'Properties owned',

  sectionB2bRequest: 'B2B account application',
  fieldTicketRef: 'Ticket reference',
  fieldB2bApproval: 'B2B approval status',
  fieldRequestSubmitted: 'Submitted',
  fieldReviewedAt: 'Reviewed',
  fieldNotes: 'Notes',

  sectionVerification: 'Verification & reputation',
  fieldIdentityVerification: 'Identity verification',
  fieldIdentityVerifiedAt: 'Identity verified on',
  fieldIdentityFailure: 'Failure reason',
  fieldVerifiedTenant: 'Verified tenant',
  fieldVerifiedOwner: 'Verified owner',
  fieldReviews: 'Reviews',
  fieldAverageRating: 'Average rating',

  stripeNote:
    'Identifiers and state only. Payments are operated from the backend, never from this panel.',
  fieldStripeMode: 'Environment',
  fieldCustomerId: 'Customer ID',
  fieldConnectAccountId: 'Connect account ID',
  fieldConnectChargesEnabled: 'Connect charges enabled',
  fieldConnectPayoutsEnabled: 'Connect payouts enabled',
  fieldConnectDisabledReason: 'Disabled reason',
  fieldRequirementsDue: 'Requirements due',
  fieldOwnerSubscription: 'Owner subscription',
  fieldSubscriptionId: 'Subscription ID',
  fieldSubscriptionRenews: 'Renews / ends',
  fieldSubscriptionWaiver: 'Waiver active',
  noStripe: 'No Stripe objects linked to this account.',

  sectionActivity: 'Activity',
  fieldContractsAsTenant: 'Contracts as tenant',
  fieldContractsAsLandlord: 'Contracts as landlord',
  fieldReportsAgainst: 'Reports received',
  fieldReportsMade: 'Reports filed',

  sectionLegal: 'Consent',
  fieldConsentVersion: 'Terms version accepted',
  fieldConsentAccepted: 'Accepted on',
  fieldConfirmedAge18: 'Age 18 confirmed',
  fieldMessagingConsent: 'Messaging consent',

  sectionAccountStatus: 'Account status',
  fieldSuspended: 'Suspended',
  fieldReason: 'Reason',
  fieldArchived: 'Archived',
  fieldPurgeAt: 'Permanent deletion',

  managedAccountInfo:
    "This account is operated on the partner's behalf by an admin.",
  openActiveManagement: 'Open in Active Management →',

  blocksPanelTitle: 'Mutual blocks',
  blocksPanelSubtitle:
    'Accounts this user has blocked, and accounts that have blocked this user. Blocking is mutual — neither side sees the other\'s listings, messages, or reviews.',
  blocksOutgoing: 'Blocked by this user',
  blocksOutgoingEmpty: 'This user has not blocked anyone.',
  blocksIncoming: 'Has blocked this user',
  blocksIncomingEmpty: 'No accounts have blocked this user.',
  blocksTruncated: 'Showing the {shown} most recent of {total}.',

  rawRecord: 'Full record (JSON)',
  rawRecordNote: 'Exactly what GET /admin/users/{id} returns.',
};

export const users = { it, en };
