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
  colCity: 'Città',
  colEmail: 'Email',
  colListed: 'Pubbl.',
  colContracts: 'Contratti',
  colIcal: 'iCal',

  // ⚠️ Tre stati, non due. "Ha un feed" e "ha un feed che funziona" sono fatti
  // diversi: la sincronizzazione è un cron notturno (05:00), quindi un feed
  // salvato di sera non ha ancora prodotto nulla fino al mattino.
  icalYes: 'Sì',
  icalPending: 'In attesa',
  icalAny: 'Tutti',
  icalWith: 'Con',
  icalWithout: 'Senza',

  view: 'Apri',
  backToList: 'Torna agli annunci',

  detailType: 'Tipo',
  detailArea: 'Zona',
  detailSource: 'Origine',
  detailInApp: 'Creato nell\'app',
  detailRooms: 'Stanze',
  detailNoRooms: 'Nessuna stanza.',
  detailRoomN: 'Stanza {n}',
  detailListing: 'Annuncio',

  icalNoFeed: 'Nessun calendario collegato a questa stanza.',
  icalSource: 'Origine feed',
  icalLastSync: 'Ultima sincronizzazione',
  icalNeverRun: 'Mai eseguita',
  icalStatus: 'Esito',
  icalFailures: 'Errori consecutivi',
  icalUrl: 'URL del feed (è una credenziale)',
  icalPendingExplain:
    'Il calendario è collegato ma non è ancora stato letto: la sincronizzazione gira ogni notte alle 05:00 (Europe/Rome). Non è un errore.',
  icalLastError: 'Ultimo errore',
  icalPartial: 'Eventi ignorati',
  icalBlocks: 'Periodi occupati da iCal ({count})',
  icalBlocksNone: 'Il feed non contiene periodi occupati.',
  icalBlocksPending: 'Nessun periodo: la prima sincronizzazione non è ancora avvenuta.',
  icalFrom: 'Dal',
  icalUntil: 'Al (escluso)',
  icalSummary: 'Descrizione',
  icalUid: 'UID',

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
  colCity: 'City',
  colEmail: 'Email',
  colListed: 'Listed',
  colContracts: 'Contracts',
  colIcal: 'iCal',

  icalYes: 'Yes',
  icalPending: 'Pending',
  icalAny: 'All',
  icalWith: 'With',
  icalWithout: 'Without',

  view: 'Open',
  backToList: 'Back to listings',

  detailType: 'Type',
  detailArea: 'Area',
  detailSource: 'Source',
  detailInApp: 'Made in the app',
  detailRooms: 'Rooms',
  detailNoRooms: 'No rooms.',
  detailRoomN: 'Room {n}',
  detailListing: 'Listing',

  icalNoFeed: 'No calendar attached to this room.',
  icalSource: 'Feed source',
  icalLastSync: 'Last sync',
  icalNeverRun: 'Never run',
  icalStatus: 'Result',
  icalFailures: 'Consecutive failures',
  icalUrl: 'Feed URL (this is a credential)',
  icalPendingExplain:
    'The calendar is attached but has not been read yet: the sync runs nightly at 05:00 (Europe/Rome). This is not a failure.',
  icalLastError: 'Last error',
  icalPartial: 'Events skipped',
  icalBlocks: 'Busy periods from iCal ({count})',
  icalBlocksNone: 'The feed contains no busy periods.',
  icalBlocksPending: 'Nothing yet — the first sync has not run.',
  icalFrom: 'From',
  icalUntil: 'Until (exclusive)',
  icalSummary: 'Summary',
  icalUid: 'UID',

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
