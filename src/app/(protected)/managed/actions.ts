'use server';

// Server Actions for the Active Management (managed accounts) flow.
//
// SECURITY MODEL (mirrors supervision/actions.ts):
//   1. Every action re-verifies the admin session via requireAdminSession().
//   2. Inputs come via FormData with the targetUid pre-bound server-side
//      where applicable (handover); the create form's inputs are validated
//      strictly before any Auth/Firestore writes happen.
//   3. All writes use firebase-admin (bypasses Firestore Rules). Rules remain
//      as defense in depth — the actual boundary is this Next.js server.
//   4. Auth custom claims are read-modify-write so we never overwrite the
//      'admin' role or other unrelated claims when setting role/b2bApproved.
//   5. Batched writes for atomicity wherever multiple docs touch the same
//      state machine.
//
// What we deliberately DON'T do here yet:
//   - Manage As (impersonation) — separate, more complex flow with custom
//     token minting and a second Firebase Auth instance. See admin-panel.md
//     §4.3 and a follow-up commit.

import 'server-only';
import crypto from 'node:crypto';
import { revalidatePath } from 'next/cache';
import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import { requireAdminSession } from '@/lib/auth';
import { serverAuth, serverDb } from '@/lib/firebase-admin';

type ActionResult<T = Record<string, never>> =
  | ({ ok: true } & T)
  | { ok: false; error: string };

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const VAT_RE = /^\d{11}$/; // Italian Partita IVA — 11 digits
const MAX_TEXT = 500;
const MAX_NOTE = 2_000;

function clamp(input: FormDataEntryValue | null, max: number): string {
  if (typeof input !== 'string') return '';
  return input.trim().slice(0, max);
}

function generateRandomPassword(length = 32): string {
  // Strong random — never displayed to the admin; the partner takes ownership
  // via the handover password-reset flow.
  return crypto.randomBytes(length).toString('base64url').slice(0, length);
}

// ---------------------------------------------------------------------------
// createManagedAccount
// ---------------------------------------------------------------------------

export async function createManagedAccount(
  formData: FormData
): Promise<ActionResult<{ uid: string }>> {
  const adminSession = await requireAdminSession();

  // Validate inputs.
  const email = clamp(formData.get('email'), MAX_TEXT).toLowerCase();
  const displayUsername = clamp(formData.get('displayUsername'), MAX_TEXT);
  const ownerType = formData.get('ownerType');
  const phoneNumber = clamp(formData.get('phoneNumber'), MAX_TEXT) || null;
  const notes = clamp(formData.get('notes'), MAX_NOTE) || null;

  if (!EMAIL_RE.test(email)) {
    return { ok: false, error: 'Invalid email address.' };
  }
  if (displayUsername.length < 2) {
    return { ok: false, error: 'Display name must be at least 2 characters.' };
  }
  if (ownerType !== 'owner_b2c' && ownerType !== 'owner_b2b') {
    return { ok: false, error: 'Select an owner type.' };
  }

  // B2C: full name; B2B: company name + VAT (required).
  let fullName: string | null = null;
  let companyName: string | null = null;
  let vatNumber: string | null = null;
  let pec: string | null = null;

  if (ownerType === 'owner_b2c') {
    fullName = clamp(formData.get('fullName'), MAX_TEXT);
    if (!fullName || fullName.length < 2) {
      return { ok: false, error: 'Full name is required for private owners.' };
    }
  } else {
    companyName = clamp(formData.get('companyName'), MAX_TEXT);
    if (!companyName || companyName.length < 2) {
      return { ok: false, error: 'Company name is required.' };
    }
    vatNumber = clamp(formData.get('vatNumber'), MAX_TEXT);
    if (!VAT_RE.test(vatNumber)) {
      return {
        ok: false,
        error: 'VAT number (Partita IVA) must be 11 digits.',
      };
    }
    pec = clamp(formData.get('pec'), MAX_TEXT) || null;
    if (pec && !EMAIL_RE.test(pec)) {
      return { ok: false, error: 'PEC must be a valid email address.' };
    }
    fullName = companyName; // for the legal-name field on users/{uid}
  }

  const auth = serverAuth();
  const db = serverDb();

  // Refuse early if an Auth user with this email already exists. createUser
  // would throw auth/email-already-exists otherwise; we surface it nicely.
  try {
    await auth.getUserByEmail(email);
    return {
      ok: false,
      error: `An account with the email ${email} already exists.`,
    };
  } catch (e: unknown) {
    if (
      !(typeof e === 'object' && e !== null && 'code' in e &&
        (e as { code: string }).code === 'auth/user-not-found')
    ) {
      console.error('[managed.create] Unexpected error checking email:', e);
      return { ok: false, error: 'Failed to verify email availability.' };
    }
    // user-not-found is expected — proceed.
  }

  // 1. Create the Auth user with a random password (never exposed; the partner
  //    sets their own via the password-reset flow on handover).
  let userRecord;
  try {
    userRecord = await auth.createUser({
      email,
      password: generateRandomPassword(),
      emailVerified: true,
      displayName: displayUsername,
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error('[managed.create] createUser failed:', e);
    return { ok: false, error: `Could not create Auth user: ${msg}` };
  }

  const uid = userRecord.uid;
  const now = Timestamp.now();

  // 2. Write users/{uid}. The splitUserOnWrite trigger will fan out the
  //    derived userProfiles / ownerProfiles docs.
  const userDoc: Record<string, unknown> = {
    uid,
    email,
    displayUsername,
    fullName,
    roles: [ownerType],
    locale: 'it',
    phoneNumber,
    identityVerificationStatus: 'unverified',
    identityVerifiedAt: null,
    managedBy: adminSession.uid,
    managedAt: now,
    managementHandedOverAt: null,
    publicDisclosure: { mode: null, badgeText: null },
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
  };
  if (ownerType === 'owner_b2b') {
    userDoc.companyName = companyName;
    userDoc.vatNumber = vatNumber;
    userDoc.pec = pec;
    // Pre-approved — managed accounts don't go through the B2B queue.
    userDoc.b2bApprovalStatus = 'approved';
    userDoc.b2bApprovedAt = now;
    userDoc.b2bApprovedByAdminUid = adminSession.uid;
  }
  if (notes) userDoc.adminNotes = notes;

  try {
    await db.collection('users').doc(uid).set(userDoc, { merge: false });
  } catch (e) {
    // Roll back the Auth user on Firestore failure so we don't orphan it.
    try {
      await auth.deleteUser(uid);
    } catch (cleanupErr) {
      console.error(
        '[managed.create] Failed to rollback Auth user after Firestore error:',
        cleanupErr
      );
    }
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, error: `Could not write user doc: ${msg}` };
  }

  // 3. Set custom claims: roles array + (for B2B) b2bApproved=true.
  //    Always read-modify-write so we never clobber other claims.
  try {
    const existingClaims = userRecord.customClaims ?? {};
    const newClaims: Record<string, unknown> = {
      ...existingClaims,
      roles: [ownerType],
    };
    if (ownerType === 'owner_b2b') newClaims.b2bApproved = true;
    await auth.setCustomUserClaims(uid, newClaims);
  } catch (e) {
    // Non-fatal — the user is created and the doc reflects state. Custom
    // claim sync can be retried by a reconciler.
    console.error('[managed.create] Failed to set custom claims for', uid, e);
  }

  revalidatePath('/managed');
  return { ok: true, uid };
}

// ---------------------------------------------------------------------------
// handoverManagedAccount
// ---------------------------------------------------------------------------

export async function handoverManagedAccount(
  targetUid: string
): Promise<ActionResult<{ email: string }>> {
  const adminSession = await requireAdminSession();

  if (!targetUid || typeof targetUid !== 'string') {
    return { ok: false, error: 'Missing target user id.' };
  }

  const db = serverDb();
  const auth = serverAuth();
  const userRef = db.collection('users').doc(targetUid);

  const snap = await userRef.get();
  if (!snap.exists) return { ok: false, error: 'User not found.' };
  const data = snap.data() ?? {};
  if (!data.managedBy) {
    return {
      ok: false,
      error: 'This account is not currently managed — nothing to hand over.',
    };
  }

  // Any admin can hand over any managed account (small team, vacation cover
  // scenarios). Original creator is preserved on the audit trail via
  // managedBy (the pre-handover value lives in adminAccountActions if we
  // ever add that collection).
  let userRecord;
  try {
    userRecord = await auth.getUser(targetUid);
  } catch (e) {
    console.error('[managed.handover] getUser failed:', e);
    return { ok: false, error: 'Auth user lookup failed.' };
  }

  const email = userRecord.email ?? '';
  if (!email) {
    return {
      ok: false,
      error: 'Cannot hand over: target user has no email on Firebase Auth.',
    };
  }

  await userRef.set(
    {
      managedBy: null,
      managementHandedOverAt: FieldValue.serverTimestamp(),
      managementHandedOverByAdminUid: adminSession.uid,
      updatedAt: FieldValue.serverTimestamp(),
    },
    { merge: true }
  );

  // Note: the password reset email itself is sent client-side via the
  // Firebase Auth web SDK after this action returns success. That uses
  // Firebase's built-in email template (configured in the Console) — there's
  // no server-side equivalent that uses that template. See the dialog
  // component for the second leg of this flow.

  revalidatePath('/managed');
  return { ok: true, email };
}
