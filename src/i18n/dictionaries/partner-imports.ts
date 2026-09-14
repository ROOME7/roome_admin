// Partner imports — uploading an operator's spreadsheet, reviewing what it
// would do, and the calendars that keep it current afterwards.

const it = {
  title: 'Importazioni partner',
  subtitle:
    "Carica il foglio di un partner, controlla riga per riga cosa verrebbe importato e conferma. Niente viene scritto finché non confermi.",

  // Upload
  uploadTitle: 'Carica un foglio',
  ownerLabel: 'Account proprietario',
  ownerPlaceholder: "Cerca per email o ragione sociale…",
  ownerHelp: 'Gli immobili importati apparterranno a questo account.',
  profileLabel: 'Mappatura salvata',
  profileNone: 'Nessuna — proponila dal file',
  fileLabel: 'File Excel (.xlsx)',
  upload: 'Carica e analizza',
  uploading: 'Analisi in corso…',

  // Preview
  previewTitle: 'Anteprima',
  previewFor: '{file} · {owner}',
  summaryProperties: 'Immobili',
  summaryRooms: 'Stanze',
  summaryCreated: '{count} nuovi',
  summaryUpdated: '{count} aggiornati',
  summaryUnchanged: '{count} invariati',
  summaryBlocked: '{count} non pubblicabili',
  summaryErrors: '{count} righe con errori',
  summaryFeeds: '{count} calendari',
  alreadyCommitted: 'Questo identico file è già stato importato il {date}.',

  // Mapping
  mappingTitle: 'Mappatura delle colonne',
  mappingHelp:
    'Ogni colonna del foglio e il campo che riempie. Correggi qui e rileggi: il file resta nel browser, non serve ricaricarlo.',
  columnHeader: 'Colonna',
  fieldHeader: 'Campo',
  fieldNone: '— non importare —',
  reread: 'Rileggi con questa mappatura',
  rereading: 'Rilettura…',
  saveProfile: 'Salva questa mappatura',
  saveProfileName: 'Nome della mappatura',
  profileSaved: 'Mappatura salvata.',

  // Rows
  rowsTitle: 'Cosa verrebbe importato',
  actionCreate: 'nuovo',
  actionUpdate: 'aggiornato',
  actionUnchanged: 'invariato',
  roomsCount: '{count} stanze',
  changesCount: '{count} modifiche',
  blockedLabel: 'Non pubblicabile',
  noCalendar: 'Nessun calendario',
  hasCalendar: 'Calendario collegato',
  showRooms: 'Mostra le stanze',
  hideRooms: 'Nascondi',

  // Decide
  commit: 'Conferma importazione',
  committing: 'Importazione…',
  discard: 'Scarta',
  discarding: 'Eliminazione…',
  committed: 'Importato: {properties} immobili e {rooms} stanze.',
  committedNote:
    "Gli immobili sono fuori mercato e le stanze non pubblicate: l'importazione non è la decisione di pubblicare.",

  // History
  historyTitle: 'Importazioni recenti',
  historyEmpty: 'Nessuna importazione ancora.',
  statusPreview: 'In attesa di conferma',
  statusCommitted: 'Importata',
  statusDiscarded: 'Scartata',
  statusFailed: 'Fallita',

  // Problems
  problemsTitle: 'Da controllare',
  noProblems: 'Nessun problema rilevato.',
};

const en: Record<keyof typeof it, string> = {
  title: 'Partner imports',
  subtitle:
    'Upload a partner’s sheet, check row by row what it would import, and confirm. Nothing is written until you do.',

  uploadTitle: 'Upload a sheet',
  ownerLabel: 'Landlord account',
  ownerPlaceholder: 'Search by email or company…',
  ownerHelp: 'Imported properties will belong to this account.',
  profileLabel: 'Saved mapping',
  profileNone: 'None — propose one from the file',
  fileLabel: 'Excel file (.xlsx)',
  upload: 'Upload and read',
  uploading: 'Reading…',

  previewTitle: 'Preview',
  previewFor: '{file} · {owner}',
  summaryProperties: 'Properties',
  summaryRooms: 'Rooms',
  summaryCreated: '{count} new',
  summaryUpdated: '{count} updated',
  summaryUnchanged: '{count} unchanged',
  summaryBlocked: '{count} not publishable',
  summaryErrors: '{count} rows with errors',
  summaryFeeds: '{count} calendars',
  alreadyCommitted: 'This exact file was already imported on {date}.',

  mappingTitle: 'Column mapping',
  mappingHelp:
    'Every column in the sheet and the field it fills. Correct it here and read again — the file stays in your browser, so there is nothing to re-pick.',
  columnHeader: 'Column',
  fieldHeader: 'Field',
  fieldNone: '— do not import —',
  reread: 'Read again with this mapping',
  rereading: 'Reading…',
  saveProfile: 'Save this mapping',
  saveProfileName: 'Mapping name',
  profileSaved: 'Mapping saved.',

  rowsTitle: 'What would be imported',
  actionCreate: 'new',
  actionUpdate: 'updated',
  actionUnchanged: 'unchanged',
  roomsCount: '{count} rooms',
  changesCount: '{count} changes',
  blockedLabel: 'Not publishable',
  noCalendar: 'No calendar',
  hasCalendar: 'Calendar linked',
  showRooms: 'Show rooms',
  hideRooms: 'Hide',

  commit: 'Commit import',
  committing: 'Importing…',
  discard: 'Discard',
  discarding: 'Discarding…',
  committed: 'Imported {properties} properties and {rooms} rooms.',
  committedNote:
    'Properties are off market and rooms unpublished: an import is not the decision to advertise.',

  historyTitle: 'Recent imports',
  historyEmpty: 'No imports yet.',
  statusPreview: 'Awaiting confirmation',
  statusCommitted: 'Imported',
  statusDiscarded: 'Discarded',
  statusFailed: 'Failed',

  problemsTitle: 'Worth checking',
  noProblems: 'Nothing flagged.',
};

export const partnerImports = { it, en };
