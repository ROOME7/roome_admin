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
import { serverAuth, serverDb, serverMessaging } from '@/lib/firebase-admin';
import { serverStripe } from '@/lib/stripe';
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
): Promise<
  ActionResult<{
    listingsArchived: number;
    subscriptionCancelled: boolean;
    subscriptionCancelError: string | null;
  }>
> {
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

  // Auto-cancel any active owner-sub via Stripe SDK. Was deferred in T2.5
  // (no Stripe SDK in admin panel at the time) — wired up in T4 alongside
  // refunds + Connect onboarding which need the same dependency.
  const subStatus = existing.ownerSubscription?.status as string | undefined;
  const subId = existing.ownerSubscription?.stripeSubscriptionId as
    | string
    | undefined;
  let subscriptionCancelled = false;
  let subscriptionCancelError: string | null = null;
  if (
    subId &&
    (subStatus === 'active' ||
      subStatus === 'trialing' ||
      subStatus === 'past_due')
  ) {
    try {
      // Cancel immediately, not at period end — archival is terminal; we
      // don't want a grace period that would re-pause listings on a
      // canceled+grace timeline.
      await serverStripe().subscriptions.cancel(subId, {
        invoice_now: false,
        prorate: true,
      });
      subscriptionCancelled = true;
      // Mirror state immediately so the admin UI reflects the cancel
      // without waiting for the webhook (the customer.subscription.deleted
      // handler will write the same state shortly).
      await userRef.set(
        {
          ownerSubscription: {
            ...(existing.ownerSubscription ?? {}),
            status: 'canceled',
            stripeSubscriptionId: subId,
          },
        },
        { merge: true }
      );
    } catch (e) {
      subscriptionCancelError =
        e instanceof Error ? e.message : String(e);
      console.error(
        '[managed.archive] Stripe subscription cancel failed:',
        e
      );
      // Non-fatal: archive still proceeds. Admin sees the error in the
      // dialog and can chase it on the Stripe Dashboard.
    }
  }

  await recordAdminAction({
    adminUid: adminSession.uid,
    targetUid,
    action: 'archive',
    payload: {
      reason: cleanedReason,
      listingsArchived,
      stripeSubscriptionId: subId ?? null,
      subscriptionCancelled,
      subscriptionCancelError,
    },
  });

  revalidatePath('/managed');
  return {
    ok: true,
    listingsArchived,
    subscriptionCancelled,
    subscriptionCancelError,
  };
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

// ---------------------------------------------------------------------------
// T4 — Admin powers
// ---------------------------------------------------------------------------
//
// All five operations target a single account (not a session / not on-behalf):
//   - Item 11: setSubscriptionWaiver — manual €150/yr waiver toggle
//   - Item 12: triggerConnectOnboarding — Stripe Connect link to partner
//   - Item 13: refundOwnerSubInvoice — refund a €150 owner-sub invoice
//   - Item 14: sendPartnerNotification — custom FCM push to partner
//   - Item 15: grantAdminRole / revokeAdminRole — promote/demote team
//
// All call recordAdminAction so adminAccountActions has a full trail.
//
// See docs/architecture/admin-panel-roadmap.md §T4 for design notes.
// ---------------------------------------------------------------------------

const MAX_FCM_TITLE = 60;
const MAX_FCM_BODY = 240;

// Helper used by every T4 action: load the user doc, refuse early when the
// account state precludes the requested admin power. Each action picks
// which guards apply (e.g. waiver toggle is fine on archived accounts;
// refund is fine on archived accounts; FCM send refuses on archived).
async function loadTarget(targetUid: string): Promise<
  | { ok: false; error: string }
  | {
      ok: true;
      ref: FirebaseFirestore.DocumentReference;
      data: FirebaseFirestore.DocumentData;
    }
> {
  if (!targetUid || typeof targetUid !== 'string') {
    return { ok: false, error: 'Missing target user id.' };
  }
  const db = serverDb();
  const ref = db.collection('users').doc(targetUid);
  const snap = await ref.get();
  if (!snap.exists) return { ok: false, error: 'User not found.' };
  return { ok: true, ref, data: snap.data() ?? {} };
}

// ---------------------------------------------------------------------------
// Item 11 — setSubscriptionWaiver
//
// Manually toggles the €150/yr waiver independently of managedBy. Used
// post-handover for strategic partners; bypasses the gate in
// assertCanPublishListing (which checks user.subscriptionWaiver.active
// before any other rule).
// ---------------------------------------------------------------------------

export async function setSubscriptionWaiver(
  targetUid: string,
  active: boolean,
  reason: string | null
): Promise<ActionResult<{ active: boolean }>> {
  const adminSession = await requireAdminSession();

  const target = await loadTarget(targetUid);
  if (!target.ok) return { ok: false, error: target.error };
  const { ref, data } = target;

  // No need to refuse on suspended/archived — waiver state is metadata
  // and doesn't affect the suspended/archived guards (which come earlier
  // in the publish gate).

  const cleanedReason = (reason ?? '').trim().slice(0, 1_000);
  if (active && cleanedReason.length < 3) {
    return {
      ok: false,
      error: 'A reason is required when granting the waiver (3+ chars).',
    };
  }

  const previousActive = data.subscriptionWaiver?.active === true;
  if (active === previousActive) {
    return {
      ok: false,
      error: active
        ? 'Waiver is already active.'
        : 'Waiver is already inactive.',
    };
  }

  await ref.set(
    {
      subscriptionWaiver: {
        active,
        reason: active ? cleanedReason : null,
        grantedAt: active ? FieldValue.serverTimestamp() : null,
        grantedByAdminUid: active ? adminSession.uid : null,
      },
      updatedAt: FieldValue.serverTimestamp(),
    },
    { merge: true }
  );

  await recordAdminAction({
    adminUid: adminSession.uid,
    targetUid,
    action: 'set_waiver',
    payload: { active, reason: active ? cleanedReason : null },
  });

  revalidatePath('/managed');
  return { ok: true, active };
}

// ---------------------------------------------------------------------------
// Item 12 — triggerConnectOnboarding
//
// Make sure the partner has a Stripe Connect Express account, generate a
// fresh Account Link, and push it to them via FCM so they can complete KYC
// + bank linking from their mobile app. Idempotent: re-running on a
// partner with an existing account just generates a new link.
// ---------------------------------------------------------------------------

export async function triggerConnectOnboarding(
  targetUid: string
): Promise<ActionResult<{ accountId: string; onboardingUrl: string }>> {
  const adminSession = await requireAdminSession();

  const target = await loadTarget(targetUid);
  if (!target.ok) return { ok: false, error: target.error };
  const { ref, data } = target;

  if (data.suspended?.active) {
    return { ok: false, error: 'Cannot onboard a suspended account.' };
  }
  if (data.deletedAt) {
    return { ok: false, error: 'Cannot onboard an archived account.' };
  }

  const roles = Array.isArray(data.roles) ? (data.roles as string[]) : [];
  if (!roles.some((r) => r.startsWith('owner_'))) {
    return {
      ok: false,
      error: 'Connect onboarding is only for owner accounts.',
    };
  }

  // Default to the public landing pages we ship at the admin domain — see
  // src/app/connect/{return,refresh}/page.tsx. Override via env to point
  // at a different deployment (preview / staging / etc.).
  const refreshUrl =
    process.env.STRIPE_CONNECT_REFRESH_URL ||
    'https://roome-admin.vercel.app/connect/refresh';
  const returnUrl =
    process.env.STRIPE_CONNECT_RETURN_URL ||
    'https://roome-admin.vercel.app/connect/return';

  const stripe = serverStripe();

  // Reuse the existing account, or create a fresh Express account if the
  // partner has never started Connect onboarding before.
  let accountId: string;
  if (typeof data.stripeConnectAccountId === 'string' && data.stripeConnectAccountId) {
    accountId = data.stripeConnectAccountId;
  } else {
    try {
      const account = await stripe.accounts.create({
        type: 'express',
        country: 'IT',
        email: typeof data.email === 'string' ? data.email : undefined,
        metadata: {
          firebaseUid: targetUid,
          createdByAdminUid: adminSession.uid,
        },
        capabilities: {
          card_payments: { requested: true },
          transfers: { requested: true },
          sepa_debit_payments: { requested: true },
        },
        business_type: roles.includes('owner_b2b') ? 'company' : 'individual',
      });
      accountId = account.id;
      await ref.set(
        {
          stripeConnectAccountId: accountId,
          connectChargesEnabled: false,
          connectPayoutsEnabled: false,
          connectRejected: false,
          connectRejectionReason: null,
          updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true }
      );
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error('[managed.connect] account create failed:', e);
      return { ok: false, error: `Stripe account create failed: ${msg}` };
    }
  }

  // Generate a fresh Account Link. Account Links are short-lived and
  // single-use — partner clicks once, completes flow, link expires.
  let onboardingUrl: string;
  try {
    const link = await stripe.accountLinks.create({
      account: accountId,
      refresh_url: refreshUrl,
      return_url: returnUrl,
      type: 'account_onboarding',
    });
    onboardingUrl = link.url;
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error('[managed.connect] account link failed:', e);
    return { ok: false, error: `Stripe Account Link failed: ${msg}` };
  }

  // Best-effort push notification — FCM failure should not block the
  // return path because the admin will probably also share the link via
  // another channel (email / WhatsApp).
  const db = serverDb();
  await db.collection('notifications').add({
    toUid: targetUid,
    kind: 'connect_onboarding_link',
    title: 'Finalizza la verifica del tuo account RooMe',
    body: 'Apri il link per completare la verifica Stripe e abilitare l’incasso dei canoni.',
    data: { url: onboardingUrl, kind: 'connect_onboarding_link' },
    createdAt: FieldValue.serverTimestamp(),
    sentByAdminUid: adminSession.uid,
  });
  try {
    const token = typeof data.fcmToken === 'string' ? data.fcmToken : null;
    if (token) {
      await serverMessaging().send({
        token,
        notification: {
          title: 'Finalizza la verifica del tuo account RooMe',
          body: 'Tocca per aprire il link Stripe.',
        },
        data: {
          kind: 'connect_onboarding_link',
          url: onboardingUrl,
        },
      });
    }
  } catch (e) {
    console.warn('[managed.connect] FCM send failed (non-fatal):', e);
  }

  await recordAdminAction({
    adminUid: adminSession.uid,
    targetUid,
    action: 'trigger_connect_onboarding',
    payload: { accountId, onboardingUrl },
  });

  revalidatePath('/managed');
  return { ok: true, accountId, onboardingUrl };
}

// ---------------------------------------------------------------------------
// Item 14 — sendPartnerNotification
//
// Writes a notifications doc + best-effort FCM push. Used for "please
// verify your IBAN", "we need a clarification on listing X", etc.
// ---------------------------------------------------------------------------

export async function sendPartnerNotification(
  targetUid: string,
  title: string,
  body: string,
  deepLink?: string | null
): Promise<ActionResult<{ delivered: boolean }>> {
  const adminSession = await requireAdminSession();

  const target = await loadTarget(targetUid);
  if (!target.ok) return { ok: false, error: target.error };
  const { data } = target;

  if (data.suspended?.active) {
    return {
      ok: false,
      error: 'Cannot notify a suspended account (they cannot sign in to read it).',
    };
  }
  if (data.deletedAt) {
    return { ok: false, error: 'Cannot notify an archived account.' };
  }

  const cleanedTitle = (title ?? '').trim().slice(0, MAX_FCM_TITLE);
  const cleanedBody = (body ?? '').trim().slice(0, MAX_FCM_BODY);
  if (cleanedTitle.length < 3) {
    return { ok: false, error: 'Title must be at least 3 characters.' };
  }
  if (cleanedBody.length < 3) {
    return { ok: false, error: 'Body must be at least 3 characters.' };
  }
  const cleanedDeepLink =
    typeof deepLink === 'string' && deepLink.trim().length > 0
      ? deepLink.trim().slice(0, 500)
      : null;

  const db = serverDb();
  const notifRef = db.collection('notifications').doc();
  await notifRef.set({
    toUid: targetUid,
    kind: 'admin_message',
    title: cleanedTitle,
    body: cleanedBody,
    data: cleanedDeepLink ? { deepLink: cleanedDeepLink } : {},
    createdAt: FieldValue.serverTimestamp(),
    sentByAdminUid: adminSession.uid,
  });

  let delivered = false;
  try {
    const token = typeof data.fcmToken === 'string' ? data.fcmToken : null;
    if (token) {
      await serverMessaging().send({
        token,
        notification: { title: cleanedTitle, body: cleanedBody },
        data: {
          kind: 'admin_message',
          ...(cleanedDeepLink ? { deepLink: cleanedDeepLink } : {}),
        },
      });
      delivered = true;
    }
  } catch (e) {
    console.warn('[managed.notify] FCM send failed (non-fatal):', e);
  }

  await recordAdminAction({
    adminUid: adminSession.uid,
    targetUid,
    action: 'notify',
    payload: {
      title: cleanedTitle,
      body: cleanedBody,
      deepLink: cleanedDeepLink,
      delivered,
    },
  });

  revalidatePath('/managed');
  return { ok: true, delivered };
}

// ---------------------------------------------------------------------------
// Item 13 — refundOwnerSubInvoice
//
// Refund a single €150 owner-subscription invoice fully or partially via
// Stripe SDK. We do NOT auto-cancel the subscription itself here — that's
// archiveManagedAccount's job. A refund without cancellation is a valid
// scenario (mid-year goodwill credit).
// ---------------------------------------------------------------------------

export interface SubInvoiceSummary {
  invoiceId: string;
  number: string | null;
  paymentIntentId: string | null;
  amountPaid: number; // cents
  amountRemaining: number; // cents (= paid - already-refunded)
  currency: string;
  created: number; // unix seconds
  status: string;
  refundedSoFar: number; // cents
}

export async function listOwnerSubInvoices(
  targetUid: string,
  limit = 12
): Promise<ActionResult<{ invoices: SubInvoiceSummary[] }>> {
  await requireAdminSession();

  const target = await loadTarget(targetUid);
  if (!target.ok) return { ok: false, error: target.error };
  const { data } = target;

  const customerId = typeof data.stripeCustomerId === 'string'
    ? data.stripeCustomerId
    : null;
  if (!customerId) {
    return { ok: true, invoices: [] };
  }

  const stripe = serverStripe();
  let invoices;
  try {
    invoices = await stripe.invoices.list({
      customer: customerId,
      limit: Math.max(1, Math.min(limit, 100)),
      expand: ['data.payment_intent'],
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error('[managed.listInvoices] stripe.invoices.list failed:', e);
    return { ok: false, error: `Stripe error: ${msg}` };
  }

  // Cross-reference: pull refunds for each invoice's PaymentIntent so we
  // can show "refundedSoFar" + cap partial refunds.
  const out: SubInvoiceSummary[] = [];
  for (const inv of invoices.data) {
    let piId: string | null = null;
    if (typeof inv.payment_intent === 'string') piId = inv.payment_intent;
    else if (inv.payment_intent && typeof inv.payment_intent === 'object')
      piId = inv.payment_intent.id ?? null;

    let refundedSoFar = 0;
    if (piId) {
      try {
        const refunds = await stripe.refunds.list({
          payment_intent: piId,
          limit: 100,
        });
        for (const r of refunds.data) {
          if (r.status === 'succeeded' || r.status === 'pending') {
            refundedSoFar += r.amount;
          }
        }
      } catch (e) {
        console.warn('[managed.listInvoices] refunds.list failed:', e);
      }
    }

    out.push({
      invoiceId: inv.id || '',
      number: inv.number ?? null,
      paymentIntentId: piId,
      amountPaid: inv.amount_paid ?? 0,
      amountRemaining: Math.max(0, (inv.amount_paid ?? 0) - refundedSoFar),
      currency: inv.currency ?? 'eur',
      created: inv.created ?? 0,
      status: inv.status ?? 'unknown',
      refundedSoFar,
    });
  }

  return { ok: true, invoices: out };
}

export async function refundOwnerSubInvoice(
  targetUid: string,
  invoiceId: string,
  amountCents: number | 'full',
  reason: string
): Promise<ActionResult<{ refundId: string; amountRefunded: number }>> {
  const adminSession = await requireAdminSession();

  const target = await loadTarget(targetUid);
  if (!target.ok) return { ok: false, error: target.error };

  if (typeof invoiceId !== 'string' || !invoiceId) {
    return { ok: false, error: 'Missing invoiceId.' };
  }
  const cleanedReason = (reason ?? '').trim().slice(0, 1_000);
  if (cleanedReason.length < 3) {
    return {
      ok: false,
      error: 'A reason is required (3+ characters).',
    };
  }

  const stripe = serverStripe();
  let invoice;
  try {
    invoice = await stripe.invoices.retrieve(invoiceId);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, error: `Could not load invoice: ${msg}` };
  }

  const piRaw = invoice.payment_intent;
  const piId =
    typeof piRaw === 'string'
      ? piRaw
      : piRaw && typeof piRaw === 'object'
        ? (piRaw.id ?? null)
        : null;
  if (!piId) {
    return {
      ok: false,
      error: 'Invoice has no payment_intent — nothing to refund.',
    };
  }

  // Cap the refund at amount_paid - already_refunded.
  let alreadyRefunded = 0;
  try {
    const refunds = await stripe.refunds.list({
      payment_intent: piId,
      limit: 100,
    });
    for (const r of refunds.data) {
      if (r.status === 'succeeded' || r.status === 'pending') {
        alreadyRefunded += r.amount;
      }
    }
  } catch (e) {
    console.warn('[managed.refund] refunds.list failed:', e);
  }
  const refundableCeiling = Math.max(
    0,
    (invoice.amount_paid ?? 0) - alreadyRefunded
  );
  if (refundableCeiling === 0) {
    return { ok: false, error: 'This invoice has already been fully refunded.' };
  }

  const refundAmount =
    amountCents === 'full' ? refundableCeiling : amountCents;
  if (
    typeof refundAmount !== 'number' ||
    refundAmount <= 0 ||
    refundAmount > refundableCeiling
  ) {
    return {
      ok: false,
      error: `Refund amount must be 1..${refundableCeiling} cents.`,
    };
  }

  let refundId: string;
  try {
    const refund = await stripe.refunds.create({
      payment_intent: piId,
      amount: refundAmount,
      reason: 'requested_by_customer',
      metadata: {
        firebaseUid: targetUid,
        invoiceId,
        triggeredByAdminUid: adminSession.uid,
        adminReason: cleanedReason,
      },
    });
    refundId = refund.id;
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error('[managed.refund] stripe.refunds.create failed:', e);
    return { ok: false, error: `Refund failed: ${msg}` };
  }

  await recordAdminAction({
    adminUid: adminSession.uid,
    targetUid,
    action: 'refund',
    payload: {
      invoiceId,
      paymentIntentId: piId,
      amountCents: refundAmount,
      refundId,
      reason: cleanedReason,
    },
  });

  revalidatePath('/managed');
  return { ok: true, refundId, amountRefunded: refundAmount };
}

// ---------------------------------------------------------------------------
// Item 15 — grantAdminRole / revokeAdminRole
//
// Adds / removes the 'admin' role on the target user's custom claims and
// writes an audit entry to adminRoleChanges (the dedicated audit collection,
// not adminAccountActions — the rules already isolate it server-only).
//
// Refuses self-revoke as a basic foot-gun guard. Bootstrap of the very
// first admin is handled by the existing Cloud Function — this path is
// for promoting / demoting team members.
// ---------------------------------------------------------------------------

export async function grantAdminRoleByEmail(
  email: string
): Promise<ActionResult<{ uid: string }>> {
  const adminSession = await requireAdminSession();

  const cleanedEmail = (email ?? '').trim().toLowerCase();
  if (!EMAIL_RE.test(cleanedEmail)) {
    return { ok: false, error: 'Invalid email address.' };
  }

  const auth = serverAuth();
  let userRecord;
  try {
    userRecord = await auth.getUserByEmail(cleanedEmail);
  } catch (e: unknown) {
    if (
      typeof e === 'object' &&
      e !== null &&
      'code' in e &&
      (e as { code: string }).code === 'auth/user-not-found'
    ) {
      return {
        ok: false,
        error: `No Firebase Auth user exists with email ${cleanedEmail}.`,
      };
    }
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, error: `Auth lookup failed: ${msg}` };
  }

  const targetUid = userRecord.uid;
  if (targetUid === adminSession.uid) {
    return {
      ok: false,
      error: 'You already have admin role on your own account.',
    };
  }

  const existingClaims = userRecord.customClaims ?? {};
  const existingRoles = Array.isArray(existingClaims.roles)
    ? (existingClaims.roles as string[])
    : [];
  if (existingRoles.includes('admin')) {
    return { ok: false, error: 'User is already an admin.' };
  }

  const newRoles = [...new Set([...existingRoles, 'admin'])];
  try {
    await auth.setCustomUserClaims(targetUid, {
      ...existingClaims,
      roles: newRoles,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, error: `Could not set custom claims: ${msg}` };
  }

  const db = serverDb();
  await db.collection('adminRoleChanges').add({
    action: 'grant',
    targetUid,
    targetEmail: cleanedEmail,
    byUid: adminSession.uid,
    at: FieldValue.serverTimestamp(),
  });

  await recordAdminAction({
    adminUid: adminSession.uid,
    targetUid,
    action: 'grant_admin',
    payload: { email: cleanedEmail },
  });

  revalidatePath('/admins');
  return { ok: true, uid: targetUid };
}

export async function revokeAdminRole(
  targetUid: string
): Promise<ActionResult> {
  const adminSession = await requireAdminSession();

  if (!targetUid || typeof targetUid !== 'string') {
    return { ok: false, error: 'Missing target user id.' };
  }
  if (targetUid === adminSession.uid) {
    return {
      ok: false,
      error: 'Self-revoke not allowed. Ask another admin to revoke your role.',
    };
  }

  const auth = serverAuth();
  let userRecord;
  try {
    userRecord = await auth.getUser(targetUid);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, error: `Auth lookup failed: ${msg}` };
  }

  const existingClaims = userRecord.customClaims ?? {};
  const existingRoles = Array.isArray(existingClaims.roles)
    ? (existingClaims.roles as string[])
    : [];
  if (!existingRoles.includes('admin')) {
    return { ok: false, error: 'User is not an admin.' };
  }

  const newRoles = existingRoles.filter((r) => r !== 'admin');
  try {
    await auth.setCustomUserClaims(targetUid, {
      ...existingClaims,
      roles: newRoles,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, error: `Could not set custom claims: ${msg}` };
  }

  const db = serverDb();
  await db.collection('adminRoleChanges').add({
    action: 'revoke',
    targetUid,
    targetEmail: userRecord.email ?? null,
    byUid: adminSession.uid,
    at: FieldValue.serverTimestamp(),
  });

  await recordAdminAction({
    adminUid: adminSession.uid,
    targetUid,
    action: 'revoke_admin',
    payload: {},
  });

  revalidatePath('/admins');
  return { ok: true };
}
