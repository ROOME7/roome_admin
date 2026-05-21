// settings strings — see common.ts for the pattern.
const it = {
  title: 'Impostazioni',
  subtitle: 'Gestisci il tuo account amministratore.',
  comingSoon: 'Modifica password + registrazione MFA in arrivo.',
};

const en: Record<keyof typeof it, string> = {
  title: 'Settings',
  subtitle: 'Manage your admin account.',
  comingSoon: 'Password change + MFA enrolment coming next.',
};

export const settings = { it, en };
