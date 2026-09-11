import "server-only";
import { cookies } from "next/headers";
import { apiBaseUrl } from "./api";

/**
 * The web session — a Backend-For-Frontend over the Roome API.
 *
 * ⚠️ THE TOKENS NEVER REACH JAVASCRIPT, AND THAT IS THE WHOLE POINT.
 *
 * The API is bearer-only: it issues a ~15-minute HS256 access token and an
 * opaque, single-use, rotating refresh token, and expects
 * `Authorization: Bearer <jwt>`. The mobile app keeps those in the Keychain /
 * Keystore. A browser has no equivalent, and the naive port — a JWT in
 * `localStorage` — is readable by any script that ever ends up on the page:
 * one compromised dependency, one injected tag, and the attacker holds a
 * live session.
 *
 * So the tokens live in httpOnly cookies that client JavaScript cannot read,
 * and every authenticated call is made from the server, where the cookie is
 * turned into an `Authorization` header. The browser holds a session it
 * cannot read and cannot leak.
 *
 * ── The refresh race ────────────────────────────────────────────────────────
 *
 * Refresh tokens are SINGLE-USE and rotated: spending one returns a new pair
 * and invalidates the old. The app never has two requests refreshing at once;
 * a browser with three tabs does. Two simultaneous refreshes mean the second
 * presents an already-spent token and is rejected, which would sign the user
 * out mid-session.
 *
 * `refreshSession` therefore de-duplicates in-process: concurrent callers
 * share one in-flight promise. That covers the common case (one server, many
 * requests). It does NOT cover two server instances refreshing the same
 * session simultaneously — for that, `withAuth` treats a failed refresh as
 * "signed out" and re-reads the cookie once, so the tab that lost the race
 * picks up the winner's cookie instead of destroying the session.
 */

const ACCESS_COOKIE = "roome_admin_at";
const REFRESH_COOKIE = "roome_admin_rt";

/**
 * Seconds of headroom before expiry at which a token is treated as stale.
 *
 * A token that expires in four seconds will very likely expire *during* the
 * request it is about to authorise, and the failure would surface as a random
 * 401 rather than as a refresh.
 */
const EXPIRY_SKEW_SECONDS = 30;

export interface SessionTokens {
  accessToken: string;
  refreshToken: string;
  /** Unix seconds. */
  expiresAt: number;
}

interface TokenResponse {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  tokenType: string;
}

/** Shape of `GET /auth/me`, only as far as this site needs it. */
export interface CurrentUser {
  id: string;
  email: string | null;
  role: string | null;
  firstName: string | null;
  lastName: string | null;
  username: string | null;
  photoUrl: string | null;
  emailVerified: boolean;
}

// ── cookie plumbing ─────────────────────────────────────────────────────────

/**
 * Cookie options.
 *
 * `httpOnly` is the load-bearing one — without it this whole module is just a
 * slower `localStorage`. `sameSite: lax` blocks the cross-site POST that a
 * CSRF attack needs while still allowing a normal top-level navigation into
 * the site (a shared listing link) to arrive signed in.
 *
 * `secure` is off on localhost only, because a Secure cookie is dropped over
 * plain http and development would silently never hold a session.
 */
function cookieOptions(maxAge: number) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge,
  };
}

/** 30 days: the refresh token's own lifetime is the real bound. */
const REFRESH_MAX_AGE = 60 * 60 * 24 * 30;

/**
 * Write cookies, tolerating the contexts where that is not allowed.
 *
 * ⚠️ NEXT ONLY PERMITS COOKIE WRITES INSIDE A SERVER ACTION OR ROUTE HANDLER,
 * and it throws otherwise. But a session can expire while a page is merely
 * being rendered — `getCurrentUser` on the listing page refreshes a stale
 * token, and a dead refresh token has to be cleared — and letting that throw
 * turns "your session ended" into a 500 on a page a guest can read perfectly
 * well.
 *
 * So the write is attempted and the refusal swallowed: during a render the
 * cookie simply stays as it was, and the next Server Action or route handler
 * corrects it. The alternative — threading "may I write cookies here?" through
 * every call site — buys nothing, because the caller's behaviour is identical
 * either way.
 */
async function setCookieSafely(
  name: string,
  value: string,
  maxAge: number,
): Promise<void> {
  try {
    (await cookies()).set(name, value, cookieOptions(maxAge));
  } catch {
    // Read-only context (a page render). See above.
  }
}

export async function writeSession(tokens: TokenResponse): Promise<void> {
  const expiresAt = Math.floor(Date.now() / 1000) + (tokens.expiresIn || 900);

  // The access cookie carries its own expiry so `readSession` can tell a stale
  // token from a live one without decoding the JWT.
  await setCookieSafely(
    ACCESS_COOKIE,
    `${tokens.accessToken}|${expiresAt}`,
    tokens.expiresIn || 900,
  );
  await setCookieSafely(REFRESH_COOKIE, tokens.refreshToken, REFRESH_MAX_AGE);
}

export async function clearSession(): Promise<void> {
  // Overwrite with an immediate expiry rather than `delete`, so the browser
  // is told to drop it even when the original was set on a different path.
  await setCookieSafely(ACCESS_COOKIE, "", 0);
  await setCookieSafely(REFRESH_COOKIE, "", 0);
}

export async function readSession(): Promise<SessionTokens | null> {
  const store = await cookies();
  const raw = store.get(ACCESS_COOKIE)?.value;
  const refreshToken = store.get(REFRESH_COOKIE)?.value;

  // No refresh token means no session at all — an access token alone expires
  // in minutes and cannot be renewed.
  if (!refreshToken) return null;
  if (!raw) return { accessToken: "", refreshToken, expiresAt: 0 };

  const sep = raw.lastIndexOf("|");
  if (sep < 0) return { accessToken: "", refreshToken, expiresAt: 0 };

  const accessToken = raw.slice(0, sep);
  const expiresAt = Number(raw.slice(sep + 1));

  return {
    accessToken,
    refreshToken,
    expiresAt: Number.isFinite(expiresAt) ? expiresAt : 0,
  };
}

export function isFresh(session: SessionTokens): boolean {
  return (
    Boolean(session.accessToken) &&
    session.expiresAt - EXPIRY_SKEW_SECONDS > Math.floor(Date.now() / 1000)
  );
}

// ── refresh ─────────────────────────────────────────────────────────────────

/**
 * In-flight refreshes, keyed by the refresh token being spent.
 *
 * Two requests arriving together must not both POST the same single-use
 * token: the loser would be rejected and would sign the user out. They share
 * one promise instead.
 */
const inFlight = new Map<string, Promise<TokenResponse | null>>();

async function spendRefreshToken(refreshToken: string): Promise<TokenResponse | null> {
  const existing = inFlight.get(refreshToken);
  if (existing) return existing;

  const promise = (async (): Promise<TokenResponse | null> => {
    try {
      const res = await fetch(`${apiBaseUrl()}/auth/refresh`, {
        method: "POST",
        headers: { "content-type": "application/json", accept: "application/json" },
        body: JSON.stringify({ refreshToken }),
        // Never cached: a rotating credential must not be served from a cache.
        cache: "no-store",
      });
      if (!res.ok) return null;
      return (await res.json()) as TokenResponse;
    } catch {
      return null;
    } finally {
      // Cleared on the next tick so callers that arrive during the microtask
      // queue still join this one rather than starting a second refresh.
      setTimeout(() => inFlight.delete(refreshToken), 0);
    }
  })();

  inFlight.set(refreshToken, promise);
  return promise;
}

/**
 * A usable access token, refreshing when necessary.
 *
 * Returns null when there is no session, or when the refresh token has been
 * spent or revoked — the caller should then treat the visitor as a guest.
 */
export async function getAccessToken(): Promise<string | null> {
  const session = await readSession();
  if (!session) return null;
  if (isFresh(session)) return session.accessToken;

  const refreshed = await spendRefreshToken(session.refreshToken);
  if (!refreshed) {
    // The token was rejected. Clearing here rather than leaving a dead cookie
    // means the next request renders a guest page instead of retrying forever.
    await clearSession();
    return null;
  }

  await writeSession(refreshed);
  return refreshed.accessToken;
}

// ── authenticated calls ─────────────────────────────────────────────────────

export class AuthRequiredError extends Error {
  constructor() {
    super("Not signed in");
    this.name = "AuthRequiredError";
  }
}

/**
 * A non-2xx from the API, carrying what the API actually said.
 *
 * ⚠️ THE `code` IS THE PART CALLERS BRANCH ON. The API answers a duplicate
 * application with `409 duplicate_application` and a full room with
 * `422 no_free_beds`, and those are different sentences to a person — one
 * means "you already did this", the other "try another room". Throwing away
 * the body and leaving callers to string-match on a status would make both of
 * them "something went wrong".
 */
export class ApiCallError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details: Record<string, unknown>;

  constructor(status: number, body: unknown) {
    const envelope = (body ?? {}) as {
      error?: { code?: string; message?: string; details?: Record<string, unknown> };
    };
    super(envelope.error?.message || `Request failed with ${status}`);
    this.name = "ApiCallError";
    this.status = status;
    this.code = envelope.error?.code ?? "";
    this.details = envelope.error?.details ?? {};
  }
}

/**
 * Call the API as the signed-in user.
 *
 * ⚠️ SERVER-SIDE ONLY, AND THE BEARER HEADER IS BUILT HERE. No component ever
 * receives a token; they receive data. That is what keeps the credential off
 * the client.
 *
 * A 401 is retried exactly once against a freshly refreshed token: the
 * previous one may have expired between the check and the call, and one retry
 * turns that race into a success rather than a spurious sign-out.
 */
export async function apiAuthed<T>(
  path: string,
  init: RequestInit & { query?: Record<string, string | number | boolean | undefined> } = {},
): Promise<T | null> {
  const token = await getAccessToken();
  if (!token) throw new AuthRequiredError();

  const { query, ...rest } = init;
  const search = new URLSearchParams();
  for (const [k, v] of Object.entries(query ?? {})) {
    if (v === undefined || v === null || v === "") continue;
    search.set(k, String(v));
  }
  const qs = search.toString();
  const url = `${apiBaseUrl()}${path.startsWith("/") ? path : `/${path}`}${qs ? `?${qs}` : ""}`;

  const call = (bearer: string) =>
    fetch(url, {
      ...rest,
      headers: {
        accept: "application/json",
        "accept-language": "it",
        ...(rest.body ? { "content-type": "application/json" } : {}),
        ...rest.headers,
        authorization: `Bearer ${bearer}`,
      },
      // Per-user data must never be cached and served to somebody else.
      cache: "no-store",
    });

  let res = await call(token);

  if (res.status === 401) {
    const session = await readSession();
    const refreshed = session ? await spendRefreshToken(session.refreshToken) : null;
    if (!refreshed) {
      await clearSession();
      throw new AuthRequiredError();
    }
    await writeSession(refreshed);
    res = await call(refreshed.accessToken);
  }

  if (res.status === 401) throw new AuthRequiredError();
  if (res.status === 404) return null;
  if (res.status === 204) return null;

  const text = await res.text();
  const body = text ? JSON.parse(text) : null;

  // 403 is NOT an auth problem here and must not be reported as one: the API
  // uses it for "you cannot apply to your own listing" and "you are blocked",
  // which are answers, not sign-in prompts. Sending somebody to the login page
  // for those would be telling them to fix the one thing that is already fine.
  if (!res.ok) throw new ApiCallError(res.status, body);

  return body as T;
}

/**
 * Who is signed in, or null.
 *
 * ⚠️ EVERY PAGE CALLS THIS, SO IT MUST NEVER THROW. A page that renders
 * differently for a guest should render the guest version when the session is
 * broken, not a 500.
 */
export async function getCurrentUser(): Promise<CurrentUser | null> {
  try {
    const me = await apiAuthed<{
      id: string;
      email?: string | null;
      role?: string | null;
      firstName?: string | null;
      lastName?: string | null;
      username?: string | null;
      photoUrl?: string | null;
      emailVerified?: boolean | null;
    }>("/auth/me");

    if (!me) return null;

    return {
      id: me.id,
      email: me.email ?? null,
      role: me.role ?? null,
      firstName: me.firstName ?? null,
      lastName: me.lastName ?? null,
      username: me.username ?? null,
      photoUrl: me.photoUrl ?? null,
      emailVerified: me.emailVerified === true,
    };
  } catch {
    return null;
  }
}

/** A display name for the header. Falls back through the fields the API has. */
export function displayName(user: CurrentUser): string {
  const full = [user.firstName, user.lastName].filter(Boolean).join(" ").trim();
  return full || user.username || user.email?.split("@")[0] || "Roome";
}
