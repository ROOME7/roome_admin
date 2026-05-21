// Users-section strings — list page and detail page.
// See common.ts for the pattern: define `it` fully, then type `en` as
// Record<keyof typeof it, string> so a missing key is a compile error.

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

  // Detail page — header badge
  badgeManagedAccount: 'Account gestito',

  // Detail page — section: Identity & contact
  sectionIdentity: 'Identità e contatti',
  fieldFullName: 'Nome completo',
  fieldUsername: 'Nome utente',
  fieldEmail: 'Email',
  fieldEmailVerified: 'Email verificata',
  fieldPhone: 'Telefono',

  // Detail page — section: Account
  sectionAccount: 'Account',
  fieldRole: 'Ruolo',
  fieldProfileCompleted: 'Profilo completato',
  fieldCreated: 'Creato',
  fieldLastUpdated: 'Ultimo aggiornamento',
  fieldAuthProvider: 'Provider di autenticazione',

  // Detail page — section: Tenant profile
  sectionTenantProfile: 'Profilo inquilino',
  fieldAge: 'Età',
  fieldGender: 'Genere',
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

  // Detail page — section: Landlord details
  sectionLandlord: 'Dettagli proprietario',
  fieldOwnerType: 'Tipo di proprietario',
  ownerTypeB2b: 'B2B (agenzia / azienda)',
  ownerTypeB2c: 'B2C (privato)',
  fieldCompanyName: 'Ragione sociale',
  fieldProperties: 'Immobili di proprietà',
  fieldB2bApproval: 'Stato approvazione B2B',

  // Detail page — section: Verification & reputation
  sectionVerification: 'Verifica e reputazione',
  fieldIdentityVerification: 'Verifica identità',
  fieldVerifiedTenant: 'Inquilino verificato',
  fieldVerifiedOwner: 'Proprietario verificato',
  fieldIdentityBadge: 'Badge identità',
  fieldReviews: 'Recensioni',
  fieldAverageRating: 'Valutazione media',

  // Detail page — section: Stripe (brand name kept as label only)
  fieldCustomerId: 'ID cliente',
  fieldConnectAccountId: 'ID account Connect',
  fieldConnectChargesEnabled: 'Addebiti Connect abilitati',
  fieldOwnerSubscription: 'Abbonamento proprietario',
  fieldSubscriptionId: 'ID abbonamento',

  // Detail page — section: Account status
  sectionAccountStatus: 'Stato account',
  fieldSuspended: 'Sospeso',
  fieldReason: 'Motivo',
  fieldArchived: 'Archiviato',

  // Detail page — managed account notice
  managedAccountInfo:
    "Questo account è gestito per conto del partner da un amministratore.",
  openActiveManagement: 'Apri in Gestione Attiva →',

  // Detail page — raw documents section
  rawDocuments: 'Documenti grezzi',
  docNotExist: '(il documento non esiste)',
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

  sectionIdentity: 'Identity & contact',
  fieldFullName: 'Full name',
  fieldUsername: 'Username',
  fieldEmail: 'Email',
  fieldEmailVerified: 'Email verified',
  fieldPhone: 'Phone',

  sectionAccount: 'Account',
  fieldRole: 'Role',
  fieldProfileCompleted: 'Profile completed',
  fieldCreated: 'Created',
  fieldLastUpdated: 'Last updated',
  fieldAuthProvider: 'Auth provider',

  sectionTenantProfile: 'Tenant profile',
  fieldAge: 'Age',
  fieldGender: 'Gender',
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

  sectionLandlord: 'Landlord details',
  fieldOwnerType: 'Owner type',
  ownerTypeB2b: 'B2B (agency / company)',
  ownerTypeB2c: 'B2C (private)',
  fieldCompanyName: 'Company name',
  fieldProperties: 'Properties owned',
  fieldB2bApproval: 'B2B approval status',

  sectionVerification: 'Verification & reputation',
  fieldIdentityVerification: 'Identity verification',
  fieldVerifiedTenant: 'Verified tenant',
  fieldVerifiedOwner: 'Verified owner',
  fieldIdentityBadge: 'Identity badge',
  fieldReviews: 'Reviews',
  fieldAverageRating: 'Average rating',

  fieldCustomerId: 'Customer ID',
  fieldConnectAccountId: 'Connect account ID',
  fieldConnectChargesEnabled: 'Connect charges enabled',
  fieldOwnerSubscription: 'Owner subscription',
  fieldSubscriptionId: 'Subscription ID',

  sectionAccountStatus: 'Account status',
  fieldSuspended: 'Suspended',
  fieldReason: 'Reason',
  fieldArchived: 'Archived',

  managedAccountInfo:
    "This account is operated on the partner's behalf by an admin.",
  openActiveManagement: 'Open in Active Management →',

  rawDocuments: 'Raw documents',
  docNotExist: '(document does not exist)',
};

export const users = { it, en };
