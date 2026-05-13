# RooMe Admin Panel

Next.js admin panel for the RooMe marketplace. Talks to the same Firebase project as the Flutter app (`roome-506d5`) — admins are Firebase Auth users with a `roles: ['admin']` custom claim.

> Architecture, design rationale, and operational runbooks live in [`docs/architecture/admin-panel.md`](https://github.com/TZTozz/roomeFlutter/blob/main/docs/architecture/admin-panel.md) in the main repo. This README is the local setup guide.

## What's built

- **Auth foundation** (this PR)
  - Email + password sign-in with admin-role gate
  - httpOnly session cookies (8h default TTL)
  - Edge-runtime proxy for cheap presence checks
  - Authoritative server-side verification in the protected layout
  - Sign-out with refresh-token revocation
  - Dashboard skeleton with placeholders for the two flows

- **Coming next**
  - `/supervision` — B2B approval queue
  - `/managed` — managed-account list with "Manage As" (impersonation)
  - Managed-account creation flow

## Prerequisites

- Node 18+ (the scaffold was built on Node 23; LTS 20/22 also fine)
- npm
- Access to the Firebase project `roome-506d5` (or your own dev project)
- A Firebase service account key (admin-panel-only — different from the one used by `backend_roome/functions/`)

## Local setup

```bash
# 1. Install dependencies
npm install

# 2. Configure environment
cp .env.example .env.local
# Edit .env.local with your Firebase web config + service account JSON.
# See "Environment variables" below.

# 3. Bootstrap the first admin (one-time per Firebase project)
# Done from the backend_roome repo — see docs/architecture/admin-panel.md §8.6:
#   cd ../backend_roome/functions
#   GOOGLE_APPLICATION_CREDENTIALS=/path/to/sa.json \
#     node scripts/bootstrap-first-admin.js <UID-FROM-FIREBASE-CONSOLE>

# 4. Run the dev server
npm run dev
# → open http://localhost:3000
# → unauthenticated visitors are bounced to /login
```

## Environment variables

| Variable | Public? | Source |
|---|---|---|
| `NEXT_PUBLIC_FIREBASE_API_KEY` | yes | Firebase Console → Project Settings → Web app config |
| `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` | yes | same |
| `NEXT_PUBLIC_FIREBASE_PROJECT_ID` | yes | same |
| `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET` | yes | same |
| `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID` | yes | same |
| `NEXT_PUBLIC_FIREBASE_APP_ID` | yes | same |
| `NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID` | yes | same (optional) |
| `FIREBASE_SERVICE_ACCOUNT_JSON` | **no — server only** | Firebase Console → Project Settings → Service Accounts → Generate New Private Key. Paste the **entire** JSON contents as a single line into `.env.local`. Never commit. |
| `SESSION_COOKIE_MAX_AGE_SECONDS` | no | Optional; defaults to 28800 (8h). Max 14 days. |

The web SDK API key is intentionally public — security comes from Firebase Rules + the admin claim, not from key secrecy. The service account JSON is the actual secret; treat it like a password.

## How auth flows through the codebase

```
unauthenticated user                authenticated admin
       │                                  │
       ▼                                  ▼
proxy.ts (Edge)            proxy.ts: cookie present → pass through
  no __session cookie               │
  → redirect /login                 ▼
                          app/(protected)/layout.tsx (Server Component)
                            verifySessionCookie + admin role check
                            → render top nav + page
```

Key files:

| File | Purpose |
|---|---|
| [`src/lib/firebase-client.ts`](src/lib/firebase-client.ts) | Browser Firebase init. Idempotent singleton. |
| [`src/lib/firebase-admin.ts`](src/lib/firebase-admin.ts) | Server Firebase Admin init. Lazy — won't crash CI builds without env vars. |
| [`src/lib/auth.ts`](src/lib/auth.ts) | Session-cookie verification + admin-role check. Used by protected layouts. |
| [`src/proxy.ts`](src/proxy.ts) | Edge-runtime presence check. Redirects anonymous traffic to `/login`. |
| [`src/app/api/session/route.ts`](src/app/api/session/route.ts) | POST: mint session cookie from ID token. DELETE: clear cookie + revoke refresh tokens. |
| [`src/app/login/page.tsx`](src/app/login/page.tsx) + [`login-form.tsx`](src/app/login/login-form.tsx) | Sign-in page. Client form verifies admin role before requesting a session cookie. |
| [`src/app/(protected)/layout.tsx`](src/app/\(protected\)/layout.tsx) | Wraps protected pages. Server-side authoritative auth check. |
| [`src/app/(protected)/page.tsx`](src/app/\(protected\)/page.tsx) | Dashboard with cards linking to the two flows. |
| [`src/components/sign-out-button.tsx`](src/components/sign-out-button.tsx) | Sign-out client component. |

## Deployment

Two viable hosts:

- **Vercel** (easiest for Next.js): paste env vars into the project settings; deploy on push. The `FIREBASE_SERVICE_ACCOUNT_JSON` goes in as an environment variable, not a file. Standard Vercel config.
- **Firebase Hosting + Cloud Functions** (keeps everything in Firebase): use `next-on-firebase` or a custom Cloud Function. More moving parts, single billing surface.

Whichever you pick:

1. Add the production domain to Firebase Auth → **Authorized domains** (Console → Authentication → Settings).
2. Move `FIREBASE_SERVICE_ACCOUNT_JSON` into the hosting platform's secret manager.
3. Set `SESSION_COOKIE_MAX_AGE_SECONDS` lower than the local default if you want stricter prod sessions.

## Production-readiness checklist (before opening up wider access)

- [ ] Enable **MFA** in Firebase Console for any account with the admin role
- [ ] Tighten the **session TTL** for production (suggest 2-4 hours)
- [ ] Add **rate limiting** at the host level on `/login` and `/api/session` to slow credential-stuffing
- [ ] Wire up **alerts** on `adminRoleChanges` writes — any role grant/revoke should ping Slack/email
- [ ] **Audit log review** cadence — schedule a weekly look at `adminRoleChanges` + `impersonationLog`
