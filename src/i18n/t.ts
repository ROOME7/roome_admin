// The translation function factory — shared by the server helper (getT)
// and the client hook (useT) so lookup behaves identically everywhere.
//
// Keys are dot-paths into the namespaced dictionary, e.g. 'dashboard.title'.
// A missing key returns the key itself: that makes the gap obvious in the
// UI instead of crashing the render.

type Nested = { [key: string]: string | Nested };

export type TVars = Record<string, string | number>;

/** t('namespace.key') → translated string, with optional {placeholder} vars. */
export type TFunc = (key: string, vars?: TVars) => string;

export function createT(dict: Nested): TFunc {
  return (key, vars) => {
    let current: string | Nested | undefined = dict;
    for (const part of key.split('.')) {
      if (current && typeof current === 'object' && part in current) {
        current = current[part];
      } else {
        if (process.env.NODE_ENV !== 'production') {
          console.warn(`[i18n] missing key: ${key}`);
        }
        return key;
      }
    }
    if (typeof current !== 'string') return key;
    if (!vars) return current;
    return current.replace(/\{(\w+)\}/g, (_, name: string) =>
      name in vars ? String(vars[name]) : `{${name}}`
    );
  };
}
