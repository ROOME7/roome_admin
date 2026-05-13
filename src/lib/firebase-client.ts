// Client-side Firebase initialisation.
//
// All values are NEXT_PUBLIC_* — they're embedded in the bundle that ships
// to the browser. Firebase web API keys are public-by-design; access control
// comes from Firestore Rules + the admin custom claim, not from key secrecy.
//
// We initialise the default app eagerly. A secondary 'impersonation' app
// will be created lazily by src/lib/impersonation.ts when (and only when)
// the admin starts a "Manage As" session — see
// docs/architecture/admin-panel.md §3.2.

import { getApp, getApps, initializeApp, type FirebaseApp } from 'firebase/app';
import { getAuth, type Auth } from 'firebase/auth';
import { getFirestore, type Firestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID,
};

// Idempotent — Next.js hot reload re-imports this module; getApps() returns
// the existing instance so we don't blow up with "Firebase app already exists".
function adminAppSingleton(): FirebaseApp {
  return getApps().length ? getApp() : initializeApp(firebaseConfig);
}

export const adminApp: FirebaseApp = adminAppSingleton();
export const adminAuth: Auth = getAuth(adminApp);
export const adminDb: Firestore = getFirestore(adminApp);
