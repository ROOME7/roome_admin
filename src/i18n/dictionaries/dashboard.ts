// dashboard strings — see common.ts for the pattern.
const it = {
  title: 'Dashboard',
  subtitle: 'Panoramica di utenti, marketplace, contratti e moderazione.',
  statTotalTenants: 'Totale inquilini',
  statTotalLandlords: 'Totale proprietari',
  statPendingB2b: 'Richieste B2B in attesa',
  statManagedAccounts: 'Account gestiti',
  statSuspendedAccounts: 'Account sospesi',
  statActiveListings: 'Annunci attivi',
  statTotalProperties: 'Totale immobili',
  statActiveTenancies: 'Contratti attivi',
  statPendingApplications: 'Candidature in attesa',
  statOpenReports: 'Segnalazioni aperte',
  recentActivity: 'Attività recente',
  lastActions: 'Ultime {count} azioni admin',
  lastAction: 'Ultima azione admin',
  emptyActivity:
    'Nessuna attività ancora — le azioni admin (sospensione, archiviazione, rimborso, notifica, modifica ruolo, operazioni per conto terzi) appariranno qui non appena vengono eseguite.',
};

const en: Record<keyof typeof it, string> = {
  title: 'Dashboard',
  subtitle: 'At-a-glance view of users, marketplace, contracts and moderation.',
  statTotalTenants: 'Total tenants',
  statTotalLandlords: 'Total landlords',
  statPendingB2b: 'Pending B2B requests',
  statManagedAccounts: 'Managed accounts',
  statSuspendedAccounts: 'Suspended accounts',
  statActiveListings: 'Active listings',
  statTotalProperties: 'Total properties',
  statActiveTenancies: 'Active tenancies',
  statPendingApplications: 'Pending applications',
  statOpenReports: 'Open reports',
  recentActivity: 'Recent activity',
  lastActions: 'Last {count} admin actions',
  lastAction: 'Last admin action',
  emptyActivity:
    'Nothing yet — admin actions (suspend, archive, refund, notify, role changes, on-behalf ops) will appear here as they happen.',
};

export const dashboard = { it, en };
