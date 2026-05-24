// Sidebar + top-bar chrome strings.

const it = {
  brand: 'Roome Admin',
  primaryNav: 'Navigazione principale',
  dashboard: 'Dashboard',
  finances: 'Finanze',
  users: 'Utenti',
  supervision: 'Supervisione e approvazione',
  managed: 'Gestione attiva',
  moderation: 'Moderazione UGC',
  admins: 'Amministratori',
  settings: 'Impostazioni',
  signOut: 'Esci',
  signingOut: 'Disconnessione…',
  adminRole: 'Amministratore',
  language: 'Lingua',
};

const en: Record<keyof typeof it, string> = {
  brand: 'Roome Admin',
  primaryNav: 'Primary',
  dashboard: 'Dashboard',
  finances: 'Finances',
  users: 'Users',
  supervision: 'Supervision & Approval',
  managed: 'Active Management',
  moderation: 'UGC Moderation',
  admins: 'Admins',
  settings: 'Settings',
  signOut: 'Sign out',
  signingOut: 'Signing out…',
  adminRole: 'Admin',
  language: 'Language',
};

export const nav = { it, en };
