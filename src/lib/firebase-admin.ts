// Server-side Firebase initialisation using firebase-admin.
//
// This module is import-poisoned for the Edge runtime — `firebase-admin`
// depends on Node-only modules. Only import this from:
//   - Server Components (default in app/ unless 'use client')
//   - Route Handlers (app/api/.../route.ts)
//   - Server Actions
// Never from middleware.ts (Edge) or 'use client' components.
//
// Credentials come from a service account JSON passed via the
// FIREBASE_SERVICE_ACCOUNT_JSON env var (a single-line stringified JSON).
// See docs/architecture/admin-panel.md §8.8 for setup.

import 'server-only';
import { cert, getApp, getApps, initializeApp, type App } from 'firebase-admin/app';
import { getAuth, type Auth } from 'firebase-admin/auth';
import { getFirestore, type Firestore } from 'firebase-admin/firestore';

function readServiceAccount() {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (!raw) {
    throw new Error(
      'FIREBASE_SERVICE_ACCOUNT_JSON env var is missing. See .env.example.'
    );
  }
  try {
    return JSON.parse(raw);
  } catch {
    throw new Error('FIREBASE_SERVICE_ACCOUNT_JSON is not valid JSON.');
  }
}

function adminAppSingleton(): App {
  if (getApps().length) return getApp();
  return initializeApp({ credential: cert(readServiceAccount()) });
}

// Lazy getters so build-time import doesn't crash when env vars are absent
// (e.g. during `next build` on a CI runner without secrets).
let _app: App | null = null;
let _auth: Auth | null = null;
let _db: Firestore | null = null;

export function serverAdminApp(): App {
  if (!_app) _app = adminAppSingleton();
  return _app;
}

export function serverAuth(): Auth {
  if (!_auth) _auth = getAuth(serverAdminApp());
  return _auth;
}

export function serverDb(): Firestore {
  if (!_db) _db = getFirestore(serverAdminApp());
  return _db;
}
