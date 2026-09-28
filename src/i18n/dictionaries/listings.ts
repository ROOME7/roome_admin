// The property directory (admin panel → Listings).

const it = {
  title: 'Annunci',
  subtitle:
    'Ogni immobile della piattaforma. Da qui puoi rimuovere le prove e i doppioni senza toccare il database.',

  tabAll: 'Tutti',
  tabOnMarket: 'Sul mercato',
  tabOffMarket: 'Fuori mercato',
  tabDeleted: 'Eliminati',

  searchPlaceholder: 'Via, città, o email del proprietario…',

  colProperty: 'Immobile',
  colOwner: 'Proprietario',
  colRooms: 'Stanze',
  colStatus: 'Stato',
  colCreated: 'Creato',

  statusOnMarket: 'Sul mercato',
  statusOffMarket: 'Fuori mercato',
  statusDeleted: 'Eliminato',

  roomsCount: '{count} stanze',
  roomsCountOne: '1 stanza',
  activeListings: '{count} pubblicate',
  fromImport: 'Da importazione',

  // ⚠️ Il numero di candidature è l'unico segnale che un annuncio non è una
  // prova. Va detto con parole, non con un badge che si può ignorare.
  hasContracts: '{count} candidature o contratti',

  selected: '{count} selezionati',
  selectAll: 'Seleziona tutti',
  clearSelection: 'Annulla selezione',
  deleteSelected: 'Elimina selezionati',
  deleteOne: 'Elimina',
  restore: 'Ripristina',

  confirmTitle: 'Eliminare {count} annunci?',
  confirmTitleOne: 'Eliminare questo annuncio?',
  confirmBody:
    'Gli annunci escono subito dal mercato e le stanze smettono di essere visibili. Le conversazioni restano: la chat è anche la cronologia dell’inquilino.',
  confirmReversible: 'L’operazione è reversibile — li ritrovi nella scheda «Eliminati».',
  confirmWarning:
    'Attenzione: {count} di questi immobili hanno candidature o contratti collegati.',
  confirmCancel: 'Annulla',
  confirmDelete: 'Elimina',
  deleting: 'Eliminazione…',
  restoring: 'Ripristino…',

  resultDeleted: '{count} annunci eliminati.',
  resultDeletedOne: 'Annuncio eliminato.',
  resultRestored: 'Annuncio ripristinato.',
  resultSkipped: '{count} erano già stati eliminati.',

  noneFound: 'Nessun annuncio trovato.',
  noneInCategory: 'Nessun annuncio in questa categoria.',
};

const en: Record<keyof typeof it, string> = {
  title: 'Listings',
  subtitle:
    'Every property on the platform. Clear out test rows and duplicates here rather than in the database.',

  tabAll: 'All',
  tabOnMarket: 'On market',
  tabOffMarket: 'Off market',
  tabDeleted: 'Deleted',

  searchPlaceholder: 'Street, city, or owner email…',

  colProperty: 'Property',
  colOwner: 'Owner',
  colRooms: 'Rooms',
  colStatus: 'Status',
  colCreated: 'Created',

  statusOnMarket: 'On market',
  statusOffMarket: 'Off market',
  statusDeleted: 'Deleted',

  roomsCount: '{count} rooms',
  roomsCountOne: '1 room',
  activeListings: '{count} listed',
  fromImport: 'From import',

  hasContracts: '{count} applications or contracts',

  selected: '{count} selected',
  selectAll: 'Select all',
  clearSelection: 'Clear selection',
  deleteSelected: 'Delete selected',
  deleteOne: 'Delete',
  restore: 'Restore',

  confirmTitle: 'Delete {count} listings?',
  confirmTitleOne: 'Delete this listing?',
  confirmBody:
    'They leave the market immediately and their rooms stop being visible. Conversations are kept — a chat is the renter’s history too.',
  confirmReversible: 'This can be undone — they reappear under the “Deleted” tab.',
  confirmWarning:
    'Careful: {count} of these have applications or contracts attached.',
  confirmCancel: 'Cancel',
  confirmDelete: 'Delete',
  deleting: 'Deleting…',
  restoring: 'Restoring…',

  resultDeleted: '{count} listings deleted.',
  resultDeletedOne: 'Listing deleted.',
  resultRestored: 'Listing restored.',
  resultSkipped: '{count} were already deleted.',

  noneFound: 'No listings found.',
  noneInCategory: 'No listings in this category.',
};

export const listings = { it, en };
