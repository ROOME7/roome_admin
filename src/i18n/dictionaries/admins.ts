// admins strings — see common.ts for the pattern. Filled during migration.
const it = {
  title: 'Amministratori',
  subtitlePre: 'Membri del team con il custom claim',
  subtitlePost: 'Concedi il ruolo tramite email; l\'utente deve già possedere un account Firebase Auth.',
  currentAdmins: 'Amministratori attuali · {count}',
  noAdmins:
    'Nessun amministratore registrato. (Se stai leggendo questo probabilmente non sei davvero a zero — il tuo stato di amministratore proviene dallo stesso claim. Se la lista è vuota potrebbe esserci un problema di sincronizzazione dei custom claims.)',
  you: 'Tu',
  joinedOn: '· iscritto il {date}',
  recentRoleChanges: 'Modifiche di ruolo recenti · {count}',
  noRoleChanges: 'Nessuna concessione o revoca registrata.',
  byUid: 'da {uid}',
  bySystem: 'da (bootstrap di sistema)',
  grantBtn: '+ Concedi ruolo amministratore',
  grantLabel: 'Concedi ruolo amministratore tramite email',
  grantPlaceholder: 'collega@roome.app',
  granting: 'Concessione in corso…',
  grant: 'Concedi',
  grantSuccess: 'Ruolo amministratore concesso a {email} (uid {uid}…).',
  revoke: 'Revoca',
  confirmRevoke: 'Conferma revoca',
  revoking: 'Revoca in corso…',
  revokeTitle: 'Revoca il ruolo amministratore a {email}',
  noEmail: '(nessuna email)',
};

const en: Record<keyof typeof it, string> = {
  title: 'Admins',
  subtitlePre: 'Team members with the',
  subtitlePost: 'custom claim. Grant by email; the target user must already have a Firebase Auth account.',
  currentAdmins: 'Current admins · {count}',
  noAdmins:
    "No admins on record. (You probably wouldn't be reading this if there were truly zero — your own admin status reads from the same claim. If this list is empty there may be a custom-claims sync issue.)",
  you: 'You',
  joinedOn: '· joined {date}',
  recentRoleChanges: 'Recent role changes · {count}',
  noRoleChanges: 'No grants or revokes recorded yet.',
  byUid: 'by {uid}',
  bySystem: 'by (system bootstrap)',
  grantBtn: '+ Grant admin',
  grantLabel: 'Grant admin by email',
  grantPlaceholder: 'teammate@roome.app',
  granting: 'Granting…',
  grant: 'Grant',
  grantSuccess: 'Granted admin to {email} (uid {uid}…).',
  revoke: 'Revoke',
  confirmRevoke: 'Confirm revoke',
  revoking: 'Revoking…',
  revokeTitle: 'Revoke admin from {email}',
  noEmail: '(no email)',
};

export const admins = { it, en };
