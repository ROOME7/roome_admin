// login strings — see common.ts for the pattern. Filled during migration.
const it = {
  subtitle: 'Accedi per gestire la piattaforma.',
  emailLabel: 'Email',
  passwordLabel: 'Password',
  signingIn: 'Accesso in corso…',
  signIn: 'Accedi',
  errInvalidCredential: 'Email o password non corretti.',
  errTooManyAttempts: 'Troppi tentativi. Riprova tra qualche minuto.',
  errNetwork: 'Errore di rete. Controlla la connessione e riprova.',
  errNotAdmin: 'Questo account non è un amministratore. Accedi con un account amministratore.',
  errSessionExpired: 'La sessione è scaduta. Effettua nuovamente l\'accesso.',
  errNotAdminContact: 'Questo account non è un amministratore. Contatta il tuo amministratore.',
  errSessionFailed: 'Creazione della sessione non riuscita ({status}).',
  errSignInFailed: 'Accesso non riuscito.',
};

const en: Record<keyof typeof it, string> = {
  subtitle: 'Sign in to manage the platform.',
  emailLabel: 'Email',
  passwordLabel: 'Password',
  signingIn: 'Signing in…',
  signIn: 'Sign in',
  errInvalidCredential: 'Email or password is incorrect.',
  errTooManyAttempts: 'Too many attempts. Try again in a few minutes.',
  errNetwork: 'Network error. Check your connection and try again.',
  errNotAdmin: 'That account is not an admin. Sign in with an admin account.',
  errSessionExpired: 'Your session expired. Please sign in again.',
  errNotAdminContact: 'That account is not an admin. Contact your administrator.',
  errSessionFailed: 'Session creation failed ({status}).',
  errSignInFailed: 'Sign in failed.',
};

export const login = { it, en };
