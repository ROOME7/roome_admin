// Assembles the per-namespace dictionary files into one object for the
// active locale. Each page/section owns its own namespace file so the
// dictionary stays navigable and edits never collide.
//
// To add a namespace: create dictionaries/<name>.ts following the pattern
// in common.ts, import it here, and add it to buildDictionary().

import type { Locale } from '../config';
import { common } from './common';
import { nav } from './nav';
import { audit } from './audit';
import { dashboard } from './dashboard';
import { finances } from './finances';
import { settings } from './settings';
import { users } from './users';
import { supervision } from './supervision';
import { admins } from './admins';
import { login } from './login';
import { managed } from './managed';
import { operate } from './operate';

export function buildDictionary(locale: Locale) {
  return {
    common: common[locale],
    nav: nav[locale],
    audit: audit[locale],
    dashboard: dashboard[locale],
    finances: finances[locale],
    settings: settings[locale],
    users: users[locale],
    supervision: supervision[locale],
    admins: admins[locale],
    login: login[locale],
    managed: managed[locale],
    operate: operate[locale],
  };
}

export type Dictionary = ReturnType<typeof buildDictionary>;
