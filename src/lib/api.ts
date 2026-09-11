import "server-only";

/**
 * The Roome API, as the admin panel talks to it.
 *
 * ⚠️ SERVER-SIDE ONLY, AND NOT BY ACCIDENT. The panel is a
 * Backend-For-Frontend: the session tokens live in httpOnly cookies the
 * browser cannot read, and every authenticated call is made from the server
 * where the cookie becomes an `Authorization` header. Exposing this base URL
 * to the client would invite someone to call the API directly from the
 * browser, which would mean putting a token where scripts can reach it.
 */
const DEFAULT_BASE_URL = "https://api.roomeapp.it";

export function apiBaseUrl(): string {
  return (process.env.ROOME_API_BASE_URL || DEFAULT_BASE_URL).replace(/\/+$/, "");
}
