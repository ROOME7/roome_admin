// admins strings — see common.ts for the pattern.
//
// ⚠️ THE GRANT AND REVOKE COPY IS GONE WITH THE BUTTONS. `role = ADMIN` is
// deliberately unreachable from the API: an endpoint that can promote its own
// caller will eventually promote a stranger's. The role is granted from a
// shell on the box, by someone who already holds the database credentials.
const it = {
  title: 'Amministratori',
  subtitle:
    'Chi può accedere a questo pannello. Il ruolo si assegna dal server, non da qui.',
  currentAdmins: 'Amministratori attuali · {count}',
  noAdmins:
    'Nessun amministratore trovato — cosa impossibile, visto che stai leggendo questa pagina. Se la lista è vuota, la chiamata a /admin/users non ha funzionato.',
  you: 'Tu',
  joinedOn: '· iscritto il {date}',
  lastSeen: '· ultimo accesso {date}',
  recentRoleChanges: 'Modifiche di ruolo recenti · {count}',
  noRoleChanges: 'Nessuna concessione o revoca registrata.',
  by: 'da {who}',
  bySystem: 'da (script sul server)',
  noEmail: '(nessuna email)',

  // How a role is actually granted.
  howToTitle: 'Come si aggiunge un amministratore',
  howToBody:
    'Il ruolo di amministratore si assegna solo dal server. Le API non possono promuovere nessuno: un endpoint capace di promuovere chi lo chiama, prima o poi promuove uno sconosciuto.',
  howToStep: 'Sulla macchina, in /opt/roome:',
  howToNote:
    'Usa admin:create per un account nuovo, admin:grant per promuoverne uno esistente e admin:revoke per togliere il ruolo. Ogni comando scrive una riga nel registro qui sotto.',

  // Action labels in the role-change log.
  actionGrant: 'concesso',
  actionRevoke: 'revocato',
  actionCreate: 'creato',
};

const en: Record<keyof typeof it, string> = {
  title: 'Admins',
  subtitle:
    'Who can sign in to this panel. The role is granted on the server, not from here.',
  currentAdmins: 'Current admins · {count}',
  noAdmins:
    'No admins found — which cannot be true, since you are reading this page. An empty list means the call to /admin/users did not work.',
  you: 'You',
  joinedOn: '· joined {date}',
  lastSeen: '· last seen {date}',
  recentRoleChanges: 'Recent role changes · {count}',
  noRoleChanges: 'No grants or revokes recorded yet.',
  by: 'by {who}',
  bySystem: 'by (script on the server)',
  noEmail: '(no email)',

  howToTitle: 'How to add an admin',
  howToBody:
    'The admin role is granted from the server only. The API cannot promote anyone: an endpoint that can promote its own caller will eventually promote a stranger’s.',
  howToStep: 'On the box, in /opt/roome:',
  howToNote:
    'Use admin:create for a new account, admin:grant to promote an existing one, and admin:revoke to take the role away. Every command writes a row in the log below.',

  actionGrant: 'granted',
  actionRevoke: 'revoked',
  actionCreate: 'created',
};

export const admins = { it, en };
