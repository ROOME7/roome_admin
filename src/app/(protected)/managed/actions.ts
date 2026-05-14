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
import { recordAdminAction } from '@/lib/audit';

type ActionResult<T = unknown> =
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

// ---------------------------------------------------------------------------
// updateManagedAccountProfile (T1.1 of admin-panel-roadmap.md)
//
// Edit the partner-facing fields on a currently-managed account.
//   - Email is NOT editable in v1 (would require Auth update + re-verification
//     UX we don't have yet). Surfaced read-only.
//   - Owner-type flip (B2C ↔ B2B) is NOT supported here — separate concern.
//   - Refuses when managedBy == null (handed-over accounts manage their own
//     profile from the partner-facing app).
// ---------------------------------------------------------------------------

export async function updateManagedAccountProfile(
  targetUid: string,
  formData: FormData
): Promise<ActionResult> {
  const adminSession = await requireAdminSession();

  if (!targetUid || typeof targetUid !== 'string') {
    return { ok: false, error: 'Missing target user id.' };
  }

  const db = serverDb();
  const userRef = db.collection('users').doc(targetUid);
  const snap = await userRef.get();
  if (!snap.exists) return { ok: false, error: 'User not found.' };
  const existing = snap.data() ?? {};

  if (!existing.managedBy) {
    return {
      ok: false,
      error:
        'This account is not currently managed — edits must come from the partner-facing app.',
    };
  }

  const roles = Array.isArray(existing.roles) ? (existing.roles as string[]) : [];
  const isB2b = roles.includes('owner_b2b');

  // Validate inputs.
  const displayUsername = clamp(formData.get('displayUsername'), MAX_TEXT);
  const phoneNumber = clamp(formData.get('phoneNumber'), MAX_TEXT) || null;
  const notes = clamp(formData.get('notes'), MAX_NOTE) || null;

  if (displayUsername.length < 2) {
    return { ok: false, error: 'Display name must be at least 2 characters.' };
  }

  const update: Record<string, unknown> = {
    displayUsername,
    phoneNumber,
    updatedAt: FieldValue.serverTimestamp(),
  };

  if (isB2b) {
    const companyName = clamp(formData.get('companyName'), MAX_TEXT);
    if (!companyName || companyName.length < 2) {
      return { ok: false, error: 'Company name is required.' };
    }
    const vatNumber = clamp(formData.get('vatNumber'), MAX_TEXT);
    if (!VAT_RE.test(vatNumber)) {
      return {
        ok: false,
        error: 'VAT number (Partita IVA) must be 11 digits.',
      };
    }
    const pec = clamp(formData.get('pec'), MAX_TEXT) || null;
    if (pec && !EMAIL_RE.test(pec)) {
      return { ok: false, error: 'PEC must be a valid email address.' };
    }
    update.companyName = companyName;
    update.vatNumber = vatNumber;
    update.pec = pec;
    update.fullName = companyName; // mirror the create-time convention
  } else {
    const fullName = clamp(formData.get('fullName'), MAX_TEXT);
    if (!fullName || fullName.length < 2) {
      return { ok: false, error: 'Full name is required for private owners.' };
    }
    update.fullName = fullName;
  }

  // adminNotes goes through the same edit form for convenience; updating it
  // here also bumps the notes audit fields. (The dedicated notes dialog
  // can update notes without touching the rest of the profile.)
  if (notes !== existing.adminNotes) {
    update.adminNotes = notes;
    update.adminNotesUpdatedAt = FieldValue.serverTimestamp();
    update.adminNotesUpdatedByUid = adminSession.uid;
  }

  try {
    await userRef.set(update, { merge: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, error: `Could not save changes: ${msg}` };
  }

  await recordAdminAction({
    adminUid: adminSession.uid,
    targetUid,
    action: 'edit_profile',
    payload: { fields: Object.keys(update) },
  });

  revalidatePath('/managed');
  return { ok: true };
}

// ---------------------------------------------------------------------------
// setManagedAccountNote (T1.2 of admin-panel-roadmap.md)
//
// Update the admin-internal note on an account. Allowed on handed-over and
// archived accounts too — notes are a running scratchpad and should survive
// across lifecycle transitions.
// ---------------------------------------------------------------------------

export async function setManagedAccountNote(
  targetUid: string,
  note: string
): Promise<ActionResult> {
  const adminSession = await requireAdminSession();

  if (!targetUid || typeof targetUid !== 'string') {
    return { ok: false, error: 'Missing target user id.' };
  }

  const cleaned = typeof note === 'string' ? note.trim().slice(0, MAX_NOTE) : '';

  const db = serverDb();
  const userRef = db.collection('users').doc(targetUid);
  const snap = await userRef.get();
  if (!snap.exists) return { ok: false, error: 'User not found.' };

  await userRef.set(
    {
      adminNotes: cleaned || null,
      adminNotesUpdatedAt: FieldValue.serverTimestamp(),
      adminNotesUpdatedByUid: adminSession.uid,
      updatedAt: FieldValue.serverTimestamp(),
    },
    { merge: true }
  );

  await recordAdminAction({
    adminUid: adminSession.uid,
    targetUid,
    action: 'set_note',
    payload: { length: cleaned.length },
  });

  revalidatePath('/managed');
  return { ok: true };
}

// ---------------------------------------------------------------------------
// setManagedAccountTags (T1.3 of admin-panel-roadmap.md)
//
// Replace the adminTags array on an account. Tags are lowercase-kebab,
// 1–40 chars, alphanumeric + dash, max 10 per account, deduped.
// ---------------------------------------------------------------------------

const TAG_RE = /^[a-z0-9][a-z0-9-]{0,39}$/;
const MAX_TAGS = 10;

export async function setManagedAccountTags(
  targetUid: string,
  rawTags: string[]
): Promise<ActionResult<{ tags: string[] }>> {
  const adminSession = await requireAdminSession();

  if (!targetUid || typeof targetUid !== 'string') {
    return { ok: false, error: 'Missing target user id.' };
  }
  if (!Array.isArray(rawTags)) {
    return { ok: false, error: 'Tags must be a list.' };
  }

  // Normalise: trim, lowercase, dedupe, sort.
  const normalised = Array.from(
    new Set(
      rawTags
        .filter((t): t is string => typeof t === 'string')
        .map((t) => t.trim().toLowerCase())
        .filter((t) => t.length > 0)
    )
  ).sort();

  if (normalised.length > MAX_TAGS) {
    return { ok: false, error: `Max ${MAX_TAGS} tags per account.` };
  }
  for (const t of normalised) {
    if (!TAG_RE.test(t)) {
      return {
        ok: false,
        error: `Invalid tag "${t}". Use lowercase letters, digits, and dashes (1–40 chars).`,
      };
    }
  }

  const db = serverDb();
  const userRef = db.collection('users').doc(targetUid);
  const snap = await userRef.get();
  if (!snap.exists) return { ok: false, error: 'User not found.' };

  await userRef.set(
    {
      adminTags: normalised,
      updatedAt: FieldValue.serverTimestamp(),
    },
    { merge: true }
  );

  await recordAdminAction({
    adminUid: adminSession.uid,
    targetUid,
    action: 'set_tags',
    payload: { tags: normalised },
  });

  revalidatePath('/managed');
  return { ok: true, tags: normalised };
}

// ---------------------------------------------------------------------------
// suspendManagedAccount / reactivateManagedAccount (T2.4 of roadmap)
//
// Suspend: disables Firebase Auth (forces sign-out, blocks sign-in) and
// pauses every `active` listing the user owns by setting status='paused'
// + pausedReason='admin_suspended'. Reactivate reverses both.
//
// Backend publish gate (assertCanPublishListing) also checks
// users/{uid}.suspended.active so a suspended owner cannot publish new
// listings via callable, even if they bypass the Auth disable.
// ---------------------------------------------------------------------------

const MAX_REASON = 1_000;

async function pauseOwnerListingsForAdmin(
  db: FirebaseFirestore.Firestore,
  ownerUid: string,
  adminUid: string
): Promise<number> {
  const snap = await db
    .collection('listings')
    .where('ownerId', '==', ownerUid)
    .where('status', '==', 'active')
    .get();

  if (snap.empty) return 0;

  // Firestore batch limit is 500 ops; chunk if a single owner ever exceeds
  // that. Practical max during the v1 timeframe is well under 500.
  let count = 0;
  for (let i = 0; i < snap.docs.length; i += 400) {
    const batch = db.batch();
    for (const doc of snap.docs.slice(i, i + 400)) {
      batch.update(doc.ref, {
        status: 'paused',
        pausedReason: 'admin_suspended',
        pausedAt: FieldValue.serverTimestamp(),
        pausedByAdminUid: adminUid,
        updatedAt: FieldValue.serverTimestamp(),
      });
      count += 1;
    }
    await batch.commit();
  }
  return count;
}

async function restoreOwnerListingsFromAdminPause(
  db: FirebaseFirestore.Firestore,
  ownerUid: string
): Promise<number> {
  const snap = await db
    .collection('listings')
    .where('ownerId', '==', ownerUid)
    .where('pausedReason', '==', 'admin_suspended')
    .get();

  if (snap.empty) return 0;

  let count = 0;
  for (let i = 0; i < snap.docs.length; i += 400) {
    const batch = db.batch();
    for (const doc of snap.docs.slice(i, i + 400)) {
      batch.update(doc.ref, {
        status: 'active',
        pausedReason: null,
        pausedAt: null,
        pausedByAdminUid: null,
        updatedAt: FieldValue.serverTimestamp(),
      });
      count += 1;
    }
    await batch.commit();
  }
  return count;
}

export async function suspendManagedAccount(
  targetUid: string,
  reason: string
): Promise<ActionResult<{ listingsPaused: number }>> {
  const adminSession = await requireAdminSession();

  if (!targetUid || typeof targetUid !== 'string') {
    return { ok: false, error: 'Missing target user id.' };
  }
  const cleanedReason = (reason ?? '').trim().slice(0, MAX_REASON);
  if (cleanedReason.length < 3) {
    return { ok: false, error: 'A reason is required (3+ characters).' };
  }

  const db = serverDb();
  const userRef = db.collection('users').doc(targetUid);
  const snap = await userRef.get();
  if (!snap.exists) return { ok: false, error: 'User not found.' };
  const existing = snap.data() ?? {};
  if (existing.suspended?.active) {
    return { ok: false, error: 'Account is already suspended.' };
  }
  if (existing.deletedAt) {
    return { ok: false, error: 'Cannot suspend an archived account.' };
  }

  // Disable Auth first — failure here is recoverable (no Firestore mutation
  // yet) and means we don't leave a "suspended in Firestore but still
  // signing in" inconsistency.
  try {
    await serverAuth().updateUser(targetUid, { disabled: true });
  } catch (e) {
    console.error('[managed.suspend] disable Auth failed:', e);
    return {
      ok: false,
      error: 'Could not disable Firebase Auth for this user.',
    };
  }

  await userRef.set(
    {
      suspended: {
        active: true,
        reason: cleanedReason,
        suspendedAt: FieldValue.serverTimestamp(),
        suspendedByAdminUid: adminSession.uid,
        reactivatedAt: null,
        reactivatedByAdminUid: null,
      },
      updatedAt: FieldValue.serverTimestamp(),
    },
    { merge: true }
  );

  const listingsPaused = await pauseOwnerListingsForAdmin(
    db,
    targetUid,
    adminSession.uid
  );

  await recordAdminAction({
    adminUid: adminSession.uid,
    targetUid,
    action: 'suspend',
    payload: { reason: cleanedReason, listingsPaused },
  });

  revalidatePath('/managed');
  return { ok: true, listingsPaused };
}

export async function reactivateManagedAccount(
  targetUid: string
): Promise<ActionResult<{ listingsRestored: number }>> {
  const adminSession = await requireAdminSession();

  if (!targetUid || typeof targetUid !== 'string') {
    return { ok: false, error: 'Missing target user id.' };
  }

  const db = serverDb();
  const userRef = db.collection('users').doc(targetUid);
  const snap = await userRef.get();
  if (!snap.exists) return { ok: false, error: 'User not found.' };
  const existing = snap.data() ?? {};
  if (!existing.suspended?.active) {
    return { ok: false, error: 'Account is not currently suspended.' };
  }
  if (existing.deletedAt) {
    return {
      ok: false,
      error: 'Cannot reactivate an archived account — un-archive separately.',
    };
  }

  try {
    await serverAuth().updateUser(targetUid, { disabled: false });
  } catch (e) {
    console.error('[managed.reactivate] re-enable Auth failed:', e);
    return {
      ok: false,
      error: 'Could not re-enable Firebase Auth for this user.',
    };
  }

  await userRef.set(
    {
      suspended: {
        active: false,
        reason: existing.suspended?.reason ?? null,
        suspendedAt: existing.suspended?.suspendedAt ?? null,
        suspendedByAdminUid: existing.suspended?.suspendedByAdminUid ?? null,
        reactivatedAt: FieldValue.serverTimestamp(),
        reactivatedByAdminUid: adminSession.uid,
      },
      updatedAt: FieldValue.serverTimestamp(),
    },
    { merge: true }
  );

  const listingsRestored = await restoreOwnerListingsFromAdminPause(
    db,
    targetUid
  );

  await recordAdminAction({
    adminUid: adminSession.uid,
    targetUid,
    action: 'reactivate',
    payload: { listingsRestored },
  });

  revalidatePath('/managed');
  return { ok: true, listingsRestored };
}

// ---------------------------------------------------------------------------
// archiveManagedAccount (T2.5 of roadmap)
//
// Soft-delete the account: disables Auth, archives every listing owned by
// the user (status='archived' + archivedReason='admin_archived'), stamps
// users/{uid}.deletedAt / deletedByAdminUid / deletionReason.
//
// Stripe subscription cancellation is NOT performed here (would require
// adding stripe-sdk + STRIPE_SECRET_KEY to roome_admin, which the panel
// doesn't otherwise need). Surface a reminder in the UI for the admin to
// cancel the sub from the Stripe Dashboard. Tracked in roadmap T2 notes.
// ---------------------------------------------------------------------------

async function archiveOwnerListingsForAdmin(
  db: FirebaseFirestore.Firestore,
  ownerUid: string,
  adminUid: string
): Promise<number> {
  const snap = await db
    .collection('listings')
    .where('ownerId', '==', ownerUid)
    .where('status', 'in', ['draft', 'awaiting_payment', 'active', 'paused'])
    .get();

  if (snap.empty) return 0;

  let count = 0;
  for (let i = 0; i < snap.docs.length; i += 400) {
    const batch = db.batch();
    for (const doc of snap.docs.slice(i, i + 400)) {
      batch.update(doc.ref, {
        status: 'archived',
        archivedAt: FieldValue.serverTimestamp(),
        archivedReason: 'admin_archived',
        archivedByAdminUid: adminUid,
        updatedAt: FieldValue.serverTimestamp(),
      });
      count += 1;
    }
    await batch.commit();
  }
  return count;
}

export async function archiveManagedAccount(
  targetUid: string,
  reason: string
): Promise<ActionResult<{ listingsArchived: number; stripeSubReminder: boolean }>> {
  const adminSession = await requireAdminSession();

  if (!targetUid || typeof targetUid !== 'string') {
    return { ok: false, error: 'Missing target user id.' };
  }
  const cleanedReason = (reason ?? '').trim().slice(0, MAX_REASON);
  if (cleanedReason.length < 3) {
    return { ok: false, error: 'A reason is required (3+ characters).' };
  }

  const db = serverDb();
  const userRef = db.collection('users').doc(targetUid);
  const snap = await userRef.get();
  if (!snap.exists) return { ok: false, error: 'User not found.' };
  const existing = snap.data() ?? {};
  if (existing.deletedAt) {
    return { ok: false, error: 'Account is already archived.' };
  }

  try {
    await serverAuth().updateUser(targetUid, { disabled: true });
  } catch (e) {
    console.error('[managed.archive] disable Auth failed:', e);
    return {
      ok: false,
      error: 'Could not disable Firebase Auth for this user.',
    };
  }

  await userRef.set(
    {
      deletedAt: FieldValue.serverTimestamp(),
      deletedByAdminUid: adminSession.uid,
      deletionReason: cleanedReason,
      updatedAt: FieldValue.serverTimestamp(),
    },
    { merge: true }
  );

  const listingsArchived = await archiveOwnerListingsForAdmin(
    db,
    targetUid,
    adminSession.uid
  );

  // Surface to the admin UI whether they need to chase the Stripe sub
  // cancellation in the Stripe Dashboard. True iff the user has a live
  // ownerSubscription record indicating an active billing relationship.
  const subStatus = existing.ownerSubscription?.status as string | undefined;
  const stripeSubReminder =
    subStatus === 'active' ||
    subStatus === 'trialing' ||
    subStatus === 'past_due';

  await recordAdminAction({
    adminUid: adminSession.uid,
    targetUid,
    action: 'archive',
    payload: { reason: cleanedReason, listingsArchived, stripeSubReminder },
  });

  revalidatePath('/managed');
  return { ok: true, listingsArchived, stripeSubReminder };
}

// ---------------------------------------------------------------------------
// reclaimManagedAccount (T2.6 of roadmap)
//
// Inverse of handoverManagedAccount: re-take an already-handed-over account.
// Refuses when the account is currently managed (managedBy != null), is
// suspended, or is archived. Leaves any active Stripe subscription alone —
// the partner keeps paying if they're subscribed; the waiver re-activates
// for accounts without one.
// ---------------------------------------------------------------------------

export async function reclaimManagedAccount(
  targetUid: string
): Promise<ActionResult> {
  const adminSession = await requireAdminSession();

  if (!targetUid || typeof targetUid !== 'string') {
    return { ok: false, error: 'Missing target user id.' };
  }

  const db = serverDb();
  const userRef = db.collection('users').doc(targetUid);
  const snap = await userRef.get();
  if (!snap.exists) return { ok: false, error: 'User not found.' };
  const existing = snap.data() ?? {};

  if (existing.managedBy) {
    return {
      ok: false,
      error:
        'This account is already managed — nothing to reclaim. Use handover first if you want to release it.',
    };
  }
  if (!existing.managementHandedOverAt) {
    return {
      ok: false,
      error:
        'This account has never been managed by an admin. Use "Create managed account" instead.',
    };
  }
  if (existing.suspended?.active) {
    return {
      ok: false,
      error: 'Cannot reclaim a suspended account — reactivate it first.',
    };
  }
  if (existing.deletedAt) {
    return { ok: false, error: 'Cannot reclaim an archived account.' };
  }

  await userRef.set(
    {
      managedBy: adminSession.uid,
      managedAt: FieldValue.serverTimestamp(),
      managementHandedOverAt: null,
      managementReclaimedAt: FieldValue.serverTimestamp(),
      managementReclaimedByAdminUid: adminSession.uid,
      updatedAt: FieldValue.serverTimestamp(),
    },
    { merge: true }
  );

  await recordAdminAction({
    adminUid: adminSession.uid,
    targetUid,
    action: 'reclaim',
    payload: {},
  });

  revalidatePath('/managed');
  return { ok: true };
}
