// serviceable-areas strings — see common.ts for the pattern.
const it = {
  title: "Aree servite",
  subtitle:
    "Le città in cui Roome è attivo. Gli inquilini scelgono tra le aree attive durante la creazione del profilo; quando un proprietario pubblica in una di queste aree, gli inquilini interessati ricevono una notifica.",
  addBtn: "+ Aggiungi area",
  addTitle: "Aggiungi un'area (ricerca OpenStreetMap)",
  searchPlaceholder: "Cerca una città italiana…",
  search: "Cerca",
  searching: "Ricerca…",
  noResults: "Nessun risultato. Prova un altro nome.",
  add: "Aggiungi",
  adding: "Aggiunta…",
  listTitle: "Aree configurate · {active} attive su {total}",
  empty: "Nessuna area ancora. Cercane una qui sopra per iniziare.",
  active: "Attiva",
  inactive: "Inattiva",
  activate: "Attiva",
  deactivate: "Disattiva",
  remove: "Rimuovi",
  removeTitle: "Rimuovi {name}",
  confirmRemove: "Conferma",
  removing: "Rimozione…",
};

const en: Record<keyof typeof it, string> = {
  title: "Serviceable areas",
  subtitle:
    "The cities where Roome operates. Tenants pick from the active areas when creating their profile; when a landlord publishes in one of these areas, interested tenants get a notification.",
  addBtn: "+ Add area",
  addTitle: "Add an area (OpenStreetMap search)",
  searchPlaceholder: "Search an Italian city…",
  search: "Search",
  searching: "Searching…",
  noResults: "No results. Try another name.",
  add: "Add",
  adding: "Adding…",
  listTitle: "Configured areas · {active} active of {total}",
  empty: "No areas yet. Search for one above to get started.",
  active: "Active",
  inactive: "Inactive",
  activate: "Activate",
  deactivate: "Deactivate",
  remove: "Remove",
  removeTitle: "Remove {name}",
  confirmRemove: "Confirm",
  removing: "Removing…",
};

export const serviceableAreas = { it, en };
