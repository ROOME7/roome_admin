// Calendar feed health — the partner calendars that keep availability current.

const it = {
  title: 'Calendari partner',
  subtitle:
    "Ogni stanza importata con un calendario del partner. La disponibilità viene ricalcolata da qui ogni notte alle 05:00, non dal foglio.",
  syncNow: 'Sincronizza ora',
  syncing: 'Sincronizzazione…',
  synced: '{synced} aggiornati, {unchanged} invariati, {failed} falliti.',
  empty: 'Nessun calendario collegato. Importa un foglio che contenga link iCal.',
  failingOnly: 'Solo quelli in errore',
  all: 'Tutti',
  room: 'Stanza',
  property: 'Immobile',
  status: 'Stato',
  lastSync: 'Ultima sincronizzazione',
  blocks: 'Periodi occupati',
  availableFrom: 'Libera dal',
  never: 'Mai',
  failures: '{count} tentativi falliti',
  urlHidden:
    'I link ai calendari non vengono mai mostrati: contengono il token di accesso alle prenotazioni del partner.',
};

const en: Record<keyof typeof it, string> = {
  title: 'Partner calendars',
  subtitle:
    'Every imported room with a partner calendar. Availability is recomputed from these nightly at 05:00, not from the sheet.',
  syncNow: 'Sync now',
  syncing: 'Syncing…',
  synced: '{synced} updated, {unchanged} unchanged, {failed} failed.',
  empty: 'No calendars linked yet. Import a sheet that carries iCal links.',
  failingOnly: 'Failing only',
  all: 'All',
  room: 'Room',
  property: 'Property',
  status: 'Status',
  lastSync: 'Last sync',
  blocks: 'Busy windows',
  availableFrom: 'Free from',
  never: 'Never',
  failures: '{count} failed attempts',
  urlHidden:
    'Calendar links are never shown: they carry the token that reads the partner’s bookings.',
};

export const calendars = { it, en };
