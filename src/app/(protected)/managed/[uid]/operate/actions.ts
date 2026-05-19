'use server';

// Server actions for the "Operate" page — admin performs partner-facing
// operations on a managed account WITHOUT impersonation sessions. Every
// write stamps `_impersonatedByAdminUid` + `_impersonatedAt` directly on
// the affected doc, so any later reader can immediately tell that the
// underlying actor was admin X and not the partner.
//
// See docs/architecture/admin-panel-roadmap.md T3 for the design rationale
// (chose this over "sign in as partner via 2nd Firebase Auth instance").

import 'server-only';
import crypto from 'node:crypto';
import { revalidatePath } from 'next/cache';
import { FieldValue } from 'firebase-admin/firestore';
import { requireAdminSession } from '@/lib/auth';
import { serverDb, serverStorage } from '@/lib/firebase-admin';
import { serverStripe } from '@/lib/stripe';
import { recordAdminAction } from '@/lib/audit';

type ActionResult<T = unknown> =
  | ({ ok: true } & T)
  | { ok: false; error: string };

const MAX_TEXT = 500;
const MAX_MESSAGE = 4_000;
const MAX_REASON = 1_000;

type LoadTargetResult =
  | { ok: false; error: string }
  | {
      ok: true;
      db: FirebaseFirestore.Firestore;
      ref: FirebaseFirestore.DocumentReference;
      data: FirebaseFirestore.DocumentData;
    };

async function loadManagedTarget(targetUid: string): Promise<LoadTargetResult> {
  if (!targetUid || typeof targetUid !== 'string') {
    return { ok: false, error: 'Missing target user id.' };
  }
  const db = serverDb();
  const ref = db.collection('users').doc(targetUid);
  const snap = await ref.get();
  if (!snap.exists) return { ok: false, error: 'Target user not found.' };
  const data = snap.data() ?? {};
  if (!data.managedBy) {
    return {
      ok: false,
      error:
        'Account is not currently managed — on-behalf actions require an active management relationship.',
    };
  }
  if (data.suspended?.active) {
    return { ok: false, error: 'Cannot act on behalf of a suspended account.' };
  }
  if (data.deletedAt) {
    return { ok: false, error: 'Cannot act on behalf of an archived account.' };
  }
  return { ok: true, db, ref, data };
}

// ---------------------------------------------------------------------------
// Item 7: sendChatMessageAs
// ---------------------------------------------------------------------------

export async function sendChatMessageAs(
  targetUid: string,
  chatId: string,
  text: string
): Promise<ActionResult<{ messageId: string }>> {
  const adminSession = await requireAdminSession();

  const target = await loadManagedTarget(targetUid);
  if (!target.ok) return { ok: false, error: target.error };
  const { db } = target;

  if (typeof chatId !== 'string' || !chatId) {
    return { ok: false, error: 'Missing chat id.' };
  }
  const body = (text ?? '').trim().slice(0, MAX_MESSAGE);
  if (body.length === 0) return { ok: false, error: 'Message is empty.' };

  const chatRef = db.collection('chats').doc(chatId);
  const chatSnap = await chatRef.get();
  if (!chatSnap.exists) return { ok: false, error: 'Chat not found.' };
  const chat = chatSnap.data() ?? {};

  if (chat.tenantId !== targetUid && chat.landlordId !== targetUid) {
    return {
      ok: false,
      error: 'Partner is not a participant of this chat.',
    };
  }
  const recipientUid =
    chat.tenantId === targetUid ? chat.landlordId : chat.tenantId;
  if (typeof recipientUid !== 'string' || !recipientUid) {
    return { ok: false, error: 'Chat is malformed (no counterparty uid).' };
  }

  const msgRef = chatRef.collection('messages').doc();
  const sentAt = FieldValue.serverTimestamp();

  const batch = db.batch();
  batch.set(msgRef, {
    senderId: targetUid, // partner on paper, admin in audit fields
    type: 'text',
    text: body,
    attachmentUrl: null,
    attachmentMimeType: null,
    attachmentSizeBytes: null,
    sentAt,
    readBy: [],
    _impersonatedByAdminUid: adminSession.uid,
    _impersonatedAt: sentAt,
  });

  // Bump chat-level lastMessage + updatedAt + unread counter on recipient.
  batch.update(chatRef, {
    lastMessage: {
      text: body,
      senderId: targetUid,
      sentAt,
    },
    updatedAt: sentAt,
    [`unread.${recipientUid}`]: FieldValue.increment(1),
  });

  await batch.commit();

  await recordAdminAction({
    adminUid: adminSession.uid,
    targetUid,
    action: 'notify', // closest existing action label; "send_message_as" lives in payload
    payload: {
      via: 'send_message_as',
      chatId,
      messageId: msgRef.id,
      length: body.length,
    },
  });

  revalidatePath(`/managed/${targetUid}/operate`);
  return { ok: true, messageId: msgRef.id };
}

// ---------------------------------------------------------------------------
// Item 8: updateListingAs
//
// Whitelisted fields only — never lets admin flip ownerId, propertyId, the
// created* timestamps, or the suspend/archive audit fields. The Flutter
// app's listing editor whitelists the same set; this mirrors it for the
// admin surface.
// ---------------------------------------------------------------------------

export interface ListingPatch {
  description?: string;
  inAppRentPaymentEnabled?: boolean;
  rentDueDayOfMonth?: number | null;
  availabilityDate?: string | null; // ISO string; converted server-side
  preferredStayLengthMonths?: number | null;
  idealTenant?: {
    ageMin?: number | null;
    ageMax?: number | null;
    genderPref?: 'male' | 'female' | 'any';
    occupationPref?: 'student' | 'worker' | 'any';
    preferredUniversityId?: string | null;
  };
}

const ALLOWED_GENDER = new Set(['male', 'female', 'any']);
const ALLOWED_OCCUPATION = new Set(['student', 'worker', 'any']);

export async function updateListingAs(
  targetUid: string,
  listingId: string,
  patch: ListingPatch
): Promise<ActionResult<{ fieldsUpdated: string[] }>> {
  const adminSession = await requireAdminSession();

  const target = await loadManagedTarget(targetUid);
  if (!target.ok) return { ok: false, error: target.error };
  const { db } = target;

  if (typeof listingId !== 'string' || !listingId) {
    return { ok: false, error: 'Missing listing id.' };
  }

  const ref = db.collection('listings').doc(listingId);
  const snap = await ref.get();
  if (!snap.exists) return { ok: false, error: 'Listing not found.' };
  const listing = snap.data() ?? {};
  if (listing.ownerId !== targetUid) {
    return {
      ok: false,
      error: 'Listing is not owned by this partner.',
    };
  }

  const update: Record<string, unknown> = {};
  const fieldsUpdated: string[] = [];

  if (typeof patch.description === 'string') {
    update.description = patch.description.trim().slice(0, 5_000);
    fieldsUpdated.push('description');
  }
  if (typeof patch.inAppRentPaymentEnabled === 'boolean') {
    update.inAppRentPaymentEnabled = patch.inAppRentPaymentEnabled;
    fieldsUpdated.push('inAppRentPaymentEnabled');
  }
  if (patch.rentDueDayOfMonth !== undefined) {
    const v = patch.rentDueDayOfMonth;
    if (v !== null && (typeof v !== 'number' || v < 1 || v > 28)) {
      return {
        ok: false,
        error: 'rentDueDayOfMonth must be 1..28 or null.',
      };
    }
    update.rentDueDayOfMonth = v;
    fieldsUpdated.push('rentDueDayOfMonth');
  }
  if (patch.availabilityDate !== undefined) {
    if (patch.availabilityDate === null) {
      update.availabilityDate = null;
    } else {
      const d = new Date(patch.availabilityDate);
      if (Number.isNaN(d.getTime())) {
        return { ok: false, error: 'availabilityDate is not a valid date.' };
      }
      update.availabilityDate = d;
    }
    fieldsUpdated.push('availabilityDate');
  }
  if (patch.preferredStayLengthMonths !== undefined) {
    const v = patch.preferredStayLengthMonths;
    if (v !== null && (typeof v !== 'number' || v < 1 || v > 120)) {
      return {
        ok: false,
        error: 'preferredStayLengthMonths must be 1..120 or null.',
      };
    }
    update.preferredStayLengthMonths = v;
    fieldsUpdated.push('preferredStayLengthMonths');
  }
  if (patch.idealTenant) {
    const it = patch.idealTenant;
    const ideal: Record<string, unknown> = { ...(listing.idealTenant ?? {}) };
    if (it.ageMin !== undefined) ideal.ageMin = it.ageMin;
    if (it.ageMax !== undefined) ideal.ageMax = it.ageMax;
    if (it.genderPref !== undefined) {
      if (!ALLOWED_GENDER.has(it.genderPref)) {
        return { ok: false, error: 'genderPref is invalid.' };
      }
      ideal.genderPref = it.genderPref;
    }
    if (it.occupationPref !== undefined) {
      if (!ALLOWED_OCCUPATION.has(it.occupationPref)) {
        return { ok: false, error: 'occupationPref is invalid.' };
      }
      ideal.occupationPref = it.occupationPref;
    }
    if (it.preferredUniversityId !== undefined) {
      ideal.preferredUniversityId = it.preferredUniversityId;
    }
    update.idealTenant = ideal;
    fieldsUpdated.push('idealTenant');
  }

  if (fieldsUpdated.length === 0) {
    return { ok: false, error: 'No fields to update.' };
  }

  update.updatedAt = FieldValue.serverTimestamp();
  update._impersonatedByAdminUid = adminSession.uid;
  update._impersonatedAt = FieldValue.serverTimestamp();

  await ref.update(update);

  await recordAdminAction({
    adminUid: adminSession.uid,
    targetUid,
    action: 'notify',
    payload: {
      via: 'edit_listing_as',
      listingId,
      fieldsUpdated,
    },
  });

  revalidatePath(`/managed/${targetUid}/operate`);
  return { ok: true, fieldsUpdated };
}

// ---------------------------------------------------------------------------
// deleteListingAs — admin removes a listing from the marketplace
//
// Listings are derived from properties by the syncListingOnPropertyWrite
// Cloud Function (the rebuild reads property.isOnMarket and writes
// listings/{propertyId}.status='active'|'paused' accordingly). So the
// cleanest "delete from marketplace" is:
//   1. Set property.isOnMarket=false → trigger flips listing to 'paused'
//   2. Override listing directly to status='archived' with an admin
//      archive marker so it's clearly distinguished from a partner-paused
//      listing.
//   3. Audit-log.
//
// Reversible (clear archivedAt + flip isOnMarket back).
// ---------------------------------------------------------------------------

export async function deleteListingAs(
  targetUid: string,
  listingId: string,
  reason?: string
): Promise<ActionResult> {
  const adminSession = await requireAdminSession();

  const target = await loadManagedTarget(targetUid);
  if (!target.ok) return { ok: false, error: target.error };
  const { db } = target;

  if (typeof listingId !== 'string' || !listingId) {
    return { ok: false, error: 'Missing listing id.' };
  }
  const cleanedReason = (reason ?? '').trim().slice(0, 1_000);

  const listingRef = db.collection('listings').doc(listingId);
  const listingSnap = await listingRef.get();
  if (!listingSnap.exists) return { ok: false, error: 'Listing not found.' };
  const listing = listingSnap.data() ?? {};
  if (listing.ownerId !== targetUid) {
    return { ok: false, error: 'Listing is not owned by this partner.' };
  }
  if (listing.status === 'archived') {
    return { ok: false, error: 'Listing is already archived.' };
  }

  const now = FieldValue.serverTimestamp();
  const batch = db.batch();

  // Flip property's marketplace flag so the auto-rebuild trigger doesn't
  // immediately recreate the listing as 'active'. (listingId === propertyId
  // by convention from publishListingAs.)
  const propertyId =
    typeof listing.propertyId === 'string' ? listing.propertyId : listingId;
  const propRef = db.collection('properties').doc(propertyId);
  batch.set(
    propRef,
    {
      isOnMarket: false,
      updatedAt: now,
      _impersonatedByAdminUid: adminSession.uid,
      _impersonatedAt: now,
    },
    { merge: true }
  );

  // Override the listing doc directly to 'archived' with admin markers so
  // the rebuild trigger (which would otherwise set status='paused' on the
  // next property write) doesn't overwrite the archive state.
  batch.set(
    listingRef,
    {
      status: 'archived',
      archivedAt: now,
      archivedReason: 'admin_archived',
      archivedByAdminUid: adminSession.uid,
      updatedAt: now,
      _impersonatedByAdminUid: adminSession.uid,
      _impersonatedAt: now,
    },
    { merge: true }
  );

  await batch.commit();

  await recordAdminAction({
    adminUid: adminSession.uid,
    targetUid,
    action: 'notify',
    payload: {
      via: 'delete_listing_as',
      listingId,
      propertyId,
      reason: cleanedReason || null,
    },
  });

  revalidatePath(`/managed/${targetUid}/operate`);
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Item 9: respondToApplicationAs
//
// Admin accepts or declines a pending tenant application on behalf of the
// landlord. Mirrors the partner-side state transition + appends a
// contracts/{id}/events/{} audit event. On accept, also flips the source
// listing to 'paused' (mirrors partner-side behavior).
// ---------------------------------------------------------------------------

export async function respondToApplicationAs(
  targetUid: string,
  contractId: string,
  decision: 'accept' | 'decline',
  reason?: string
): Promise<ActionResult> {
  const adminSession = await requireAdminSession();

  const target = await loadManagedTarget(targetUid);
  if (!target.ok) return { ok: false, error: target.error };
  const { db } = target;

  if (typeof contractId !== 'string' || !contractId) {
    return { ok: false, error: 'Missing contract id.' };
  }
  if (decision !== 'accept' && decision !== 'decline') {
    return { ok: false, error: 'decision must be "accept" or "decline".' };
  }
  const cleanedReason = (reason ?? '').trim().slice(0, MAX_REASON);
  if (decision === 'decline' && cleanedReason.length < 3) {
    return { ok: false, error: 'A reason is required when declining (3+ chars).' };
  }

  const contractRef = db.collection('contracts').doc(contractId);
  const contractSnap = await contractRef.get();
  if (!contractSnap.exists) return { ok: false, error: 'Contract not found.' };
  const contract = contractSnap.data() ?? {};
  if (contract.landlordId !== targetUid) {
    return {
      ok: false,
      error: 'Partner is not the landlord on this contract.',
    };
  }
  if (contract.status !== 'pending') {
    return {
      ok: false,
      error: `Contract is in status "${contract.status}" — only pending applications can be accepted/declined.`,
    };
  }

  const now = FieldValue.serverTimestamp();
  const batch = db.batch();

  const contractUpdate: Record<string, unknown> = {
    updatedAt: now,
    _impersonatedByAdminUid: adminSession.uid,
    _impersonatedAt: now,
  };
  if (decision === 'accept') {
    contractUpdate.status = 'active';
    contractUpdate.activatedAt = now;
  } else {
    contractUpdate.status = 'cancelled';
    contractUpdate.terminatedAt = now;
    contractUpdate.terminatedBy = 'landlord';
    contractUpdate.terminationReason = cleanedReason;
  }
  batch.update(contractRef, contractUpdate);

  // On accept: mirror partner-side behavior of pausing the source listing.
  if (decision === 'accept' && typeof contract.listingId === 'string') {
    const listingRef = db.collection('listings').doc(contract.listingId);
    batch.update(listingRef, {
      status: 'paused',
      updatedAt: now,
      _impersonatedByAdminUid: adminSession.uid,
      _impersonatedAt: now,
    });
  }

  // Audit event in the contract subcollection.
  const eventRef = contractRef.collection('events').doc();
  batch.set(eventRef, {
    type:
      decision === 'accept' ? 'application_accepted' : 'application_declined',
    actorUid: targetUid, // partner on paper
    occurredAt: now,
    payload:
      decision === 'decline'
        ? { reason: cleanedReason, contractId }
        : { contractId, roomId: contract.roomId },
    _impersonatedByAdminUid: adminSession.uid,
    _impersonatedAt: now,
  });

  await batch.commit();

  await recordAdminAction({
    adminUid: adminSession.uid,
    targetUid,
    action: 'notify',
    payload: {
      via: 'respond_application_as',
      contractId,
      decision,
      reason: decision === 'decline' ? cleanedReason : null,
    },
  });

  revalidatePath(`/managed/${targetUid}/operate`);
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Read helpers (server-side, called from page.tsx)
// ---------------------------------------------------------------------------

export interface OperateChatsSummary {
  chatId: string;
  counterpartyUid: string;
  lastMessageText: string | null;
  lastMessageAt: Date | null;
  unread: number;
}

export interface OperateListingSummary {
  listingId: string;
  propertyId: string;
  status: string;
  region: string | null;
  province: string | null;
  description: string;
  // Photos live on `properties/{id}.photoUrls[]`, not on the derived
  // listing doc (the `_rebuildListingForProperty` Cloud Function doesn't
  // denorm them). The page loader batch-reads the property docs to fill
  // this in so the admin UI can render thumbnails.
  photoUrls: string[];
  inAppRentPaymentEnabled: boolean;
  rentDueDayOfMonth: number | null;
  idealTenant: {
    ageMin: number | null;
    ageMax: number | null;
    genderPref: string;
    occupationPref: string;
    preferredUniversityId: string | null;
  };
  preferredStayLengthMonths: number | null;
  availabilityDate: Date | null;
}

export interface OperateApplicationSummary {
  contractId: string;
  tenantId: string;
  tenantDisplayName: string;
  roomId: string;
  listingId: string | null;
  appliedAt: Date | null;
}

// ---------------------------------------------------------------------------
// Item 11-T3B: publishListingAs
//
// What we actually create here is a *property* (+ its rooms subcollection)
// with isOnMarket=true. The `listings/{id}` doc itself is auto-built by
// the syncListingOnPropertyWrite Cloud Function — listings are derived
// from property+rooms, not authored independently.
//
// SCHEMA WARNING (2026-05-18 client feedback #4): the Flutter app's
// HouseData.fromFirestore reads `address` as a top-level STRING (the street
// name), `civic` as the street number, and `city` at top level. Rooms read
// `price` (euros), `condoFees` (euros), `infoRoom`, `numOfPeople`,
// `occupants`. Writing the admin-friendly nested shape (`address: {...}`,
// `pricePerPersonCents`) crashed Flutter listing reads — Map cast to String
// blew up the user-facing listings tab. This action mirrors Flutter's
// add_house_screen.dart write shape so user-side reads stay safe.
//
// Audit stamps land on:
//   - properties/{propertyId} itself
//   - each properties/{propertyId}/rooms/{roomId} subdoc
// They will NOT automatically end up on the derived listing doc — the
// rebuild fn doesn't know about them — but the property doc IS the source
// of truth, and any later listing edit goes through updateListingAs which
// stamps the listing doc directly.
// ---------------------------------------------------------------------------

// Replicates Flutter's _generateSearchTerms (add_house_screen.dart): lower-case
// "city address" and emit every prefix substring. Used by the tenant-side
// listings search bar (prefix-match query against `properties.searchTerms`).
function generateSearchTerms(city: string, address: string): string[] {
  const fullText = `${city} ${address}`.toLowerCase();
  const out = new Set<string>();
  for (let i = 1; i <= fullText.length; i += 1) {
    out.add(fullText.substring(0, i).trim());
  }
  return Array.from(out);
}

export interface RoomInput {
  type: 'single' | 'double' | 'master';
  pricePerPersonCents: number;
  condoFeesCents?: number;
  bedCount: number;
  /**
   * Initial occupancy status for the room when the listing is published.
   * Defaults to 'available' if the caller omits it (Flutter app sets this
   * via the room form on the partner-facing screen; admin Create-Listing
   * dialog forces the admin to pick — 2026-05-18 client feedback #3).
   */
  status?: 'available' | 'occupied';
  description?: string;
}

export interface PublishListingInput {
  // Address
  street: string;
  streetNumber: string;
  postalCode: string;
  city: string;
  province: string;
  region: string;
  neighborhood?: string;
  // Geocoded coordinates from the Nominatim autocomplete. Optional — if the
  // admin types the address manually we write `null` so the tenant-side
  // map section hides instead of centring on (0,0). Bug round 2026-05-19
  // #3 (client feedback).
  latitude?: number;
  longitude?: number;
  // Facts
  propertyType: 'apartment' | 'house' | 'shared_house';
  floor?: number | null;
  totalBathrooms: number;
  description: string;
  // Listing-level
  inAppRentPaymentEnabled: boolean;
  rentDueDayOfMonth?: number | null;
  // Rooms (must be 1+)
  rooms: RoomInput[];
}

const ALLOWED_ROOM_TYPES = new Set(['single', 'double', 'master']);
const ALLOWED_PROPERTY_TYPES = new Set(['apartment', 'house', 'shared_house']);

function validatePublishInput(input: PublishListingInput):
  | { ok: true }
  | { ok: false; error: string } {
  if (!input || typeof input !== 'object') {
    return { ok: false, error: 'Invalid listing payload.' };
  }
  const requiredStr = (v: unknown, name: string) =>
    typeof v === 'string' && v.trim().length > 0
      ? null
      : `Missing ${name}.`;
  for (const [v, name] of [
    [input.street, 'street'],
    [input.streetNumber, 'streetNumber'],
    [input.postalCode, 'postalCode'],
    [input.city, 'city'],
    [input.province, 'province'],
    [input.region, 'region'],
    [input.description, 'description'],
  ] as const) {
    const err = requiredStr(v, name);
    if (err) return { ok: false, error: err };
  }
  if (!ALLOWED_PROPERTY_TYPES.has(input.propertyType)) {
    return { ok: false, error: 'propertyType is invalid.' };
  }
  if (typeof input.totalBathrooms !== 'number' || input.totalBathrooms < 0) {
    return { ok: false, error: 'totalBathrooms must be ≥ 0.' };
  }
  if (typeof input.inAppRentPaymentEnabled !== 'boolean') {
    return { ok: false, error: 'inAppRentPaymentEnabled must be a boolean.' };
  }
  if (input.inAppRentPaymentEnabled) {
    if (
      typeof input.rentDueDayOfMonth !== 'number' ||
      input.rentDueDayOfMonth < 1 ||
      input.rentDueDayOfMonth > 28
    ) {
      return {
        ok: false,
        error: 'rentDueDayOfMonth (1–28) is required when In-App Rent Payment is enabled.',
      };
    }
  }
  if (!Array.isArray(input.rooms) || input.rooms.length === 0) {
    return { ok: false, error: 'At least one room is required.' };
  }
  for (let i = 0; i < input.rooms.length; i += 1) {
    const r = input.rooms[i];
    if (!ALLOWED_ROOM_TYPES.has(r.type)) {
      return { ok: false, error: `Room ${i + 1}: type must be single/double/master.` };
    }
    if (typeof r.pricePerPersonCents !== 'number' || r.pricePerPersonCents <= 0) {
      return { ok: false, error: `Room ${i + 1}: pricePerPersonCents must be > 0.` };
    }
    if (
      typeof r.bedCount !== 'number' ||
      r.bedCount < 1 ||
      r.bedCount > 6
    ) {
      return { ok: false, error: `Room ${i + 1}: bedCount must be 1–6.` };
    }
  }
  return { ok: true };
}

export async function publishListingAs(
  targetUid: string,
  input: PublishListingInput
): Promise<ActionResult<{ propertyId: string; listingId: string }>> {
  const adminSession = await requireAdminSession();

  const target = await loadManagedTarget(targetUid);
  if (!target.ok) return { ok: false, error: target.error };
  const { db } = target;

  const validation = validatePublishInput(input);
  if (!validation.ok) return { ok: false, error: validation.error };

  const totalBeds = input.rooms.reduce((acc, r) => acc + r.bedCount, 0);
  const totalRooms = input.rooms.length;

  const propRef = db.collection('properties').doc();
  const propertyId = propRef.id;
  const now = FieldValue.serverTimestamp();

  const street = input.street.trim();
  const streetNumber = input.streetNumber.trim();
  const city = input.city.trim();
  const region = input.region.trim();
  const province = input.province.trim();
  const neighborhood = input.neighborhood?.trim() || null;

  // Aggregate room-derived denorm fields the way Flutter does
  // (add_house_screen.dart lines 594-604). Prices in EUROS for the property
  // doc — the room-level price is in euros too. `_rebuildListingForProperty`
  // converts to cents when populating listings/{id}.search.lowestPriceCents.
  let lowestPrice = Number.POSITIVE_INFINITY;
  let hasSingle = false;
  let hasDouble = false;
  for (const r of input.rooms) {
    const euros = r.pricePerPersonCents / 100;
    if (euros < lowestPrice) lowestPrice = euros;
    if (r.bedCount === 1) hasSingle = true;
    if (r.bedCount >= 2) hasDouble = true;
  }
  if (!Number.isFinite(lowestPrice)) lowestPrice = 0;

  const batch = db.batch();
  batch.set(propRef, {
    propertyId,
    ownerId: targetUid,

    // ---- Flutter HouseData.fromFirestore shape (REQUIRED) ----
    // Top-level scalars: Flutter casts data['address'] to String, so this
    // MUST be a string and NOT a nested map.
    address: street,
    civic: streetNumber,
    city,
    infoHouse: input.description.trim().slice(0, 5_000),
    // Coordinates come from the Nominatim autocomplete in the admin form.
    // If the admin typed the address manually (no pick), we write `null`
    // so HouseData.latitude reads null and the tenant-side map section
    // hides — preferable to centring on (0,0) which is the Gulf of Guinea.
    // Flutter's fromFirestore handles null with `data['latitude']?.toDouble()`.
    latitude:
      typeof input.latitude === 'number' && Number.isFinite(input.latitude)
        ? input.latitude
        : null,
    longitude:
      typeof input.longitude === 'number' && Number.isFinite(input.longitude)
        ? input.longitude
        : null,
    // When we DO have coordinates they come from a real geocode → not
    // approximate. When we don't, isApproximate is irrelevant since the
    // map section won't render at all.
    isApproximate: !(
      typeof input.latitude === 'number' &&
      Number.isFinite(input.latitude) &&
      typeof input.longitude === 'number' &&
      Number.isFinite(input.longitude)
    ),
    isOnMarket: true,
    photoUrls: [],
    hasPhotos: false,
    hasSingle,
    hasDouble,
    lowestPrice,
    searchTerms: generateSearchTerms(city, street),
    // Flutter requires `houseProfile` for the compatibility-scoring path.
    // Admin UI doesn't collect ideal-tenant criteria yet — default to
    // "indifferente" so the listing matches every tenant.
    houseProfile: {
      ageMin: 18,
      ageMax: 30,
      gender: 'indifferente',
      status: 'indifferente',
      professionalArea: 'Indifferente',
    },
    inAppRentPaymentEnabled: input.inAppRentPaymentEnabled,
    rentDueDayOfMonth: input.inAppRentPaymentEnabled
      ? input.rentDueDayOfMonth
      : null,

    // ---- Listing-rebuild denorm (`_rebuildListingForProperty` reads these
    // straight off the property doc to populate listings/{id}.search). ----
    region,
    province,
    neighborhood,

    // ---- Admin-only metadata (Flutter ignores; useful in admin UI) ----
    postalCode: input.postalCode.trim(),
    propertyType: input.propertyType,
    floor: typeof input.floor === 'number' ? input.floor : null,
    totalRooms,
    totalBeds,
    totalBathrooms: input.totalBathrooms,

    createdAt: now,
    updatedAt: now,
    deletedAt: null,
    _impersonatedByAdminUid: adminSession.uid,
    _impersonatedAt: now,
  });

  for (const r of input.rooms) {
    const roomRef = propRef.collection('rooms').doc();
    const occupied = r.status === 'occupied';
    // Flutter's RoomData.toFirestore writes `occupants` as a List<String>
    // sized to numOfPeople — empty string per free bed, occupant name per
    // taken bed. Admin doesn't capture per-bed occupant names, so when the
    // admin marks the whole room as occupied we fill placeholders so
    // `isFree`/availableSpots come out right on the Flutter side.
    const occupants = Array.from({ length: r.bedCount }, () =>
      occupied ? 'Occupato' : ''
    );
    batch.set(roomRef, {
      // Flutter RoomData.fromFirestore shape (euros, numOfPeople,
      // infoRoom, occupants).
      isFree: !occupied,
      price: r.pricePerPersonCents / 100,
      condoFees: (r.condoFeesCents ?? 0) / 100,
      infoRoom: r.description?.trim().slice(0, 2_000) || '',
      numOfPeople: r.bedCount,
      occupants,
      photoUrls: [],

      // Listing-rebuild denorm (RoomData.toFirestore writes these too).
      type: r.type,
      bedCount: r.bedCount,
      status: occupied ? 'occupied' : 'available',

      // Admin-only audit
      roomId: roomRef.id,
      createdAt: now,
      updatedAt: now,
      _impersonatedByAdminUid: adminSession.uid,
      _impersonatedAt: now,
    });
  }

  await batch.commit();

  // The syncListingOnPropertyWrite trigger fires async and rebuilds the
  // listings/{propertyId} doc. listingId === propertyId by convention.
  await recordAdminAction({
    adminUid: adminSession.uid,
    targetUid,
    action: 'notify',
    payload: {
      via: 'publish_listing_as',
      propertyId,
      roomCount: totalRooms,
      totalBeds,
    },
  });

  revalidatePath(`/managed/${targetUid}/operate`);
  return { ok: true, propertyId, listingId: propertyId };
}

// ---------------------------------------------------------------------------
// Item 12-T3B: uploadListingPhotoAs
//
// Uploads a single image file to Cloud Storage under
//   properties/{propertyId}/photos/{generatedFileName}
// and appends the download URL to properties/{propertyId}.photoUrls[]
// with audit stamps on the parent property.
//
// Why one file per call (not multi-file): Next.js server actions accept
// FormData with files but each invocation should be small. UI sends N
// separate calls when uploading multiple files. Simpler error handling,
// and partial-failure semantics are easy to reason about.
// ---------------------------------------------------------------------------

const MAX_PHOTO_BYTES = 8 * 1024 * 1024; // 8 MB — generous for phone photos
const ALLOWED_PHOTO_MIME = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/heic',
  'image/heif',
]);

function extensionFor(mime: string): string {
  switch (mime) {
    case 'image/jpeg':
      return 'jpg';
    case 'image/png':
      return 'png';
    case 'image/webp':
      return 'webp';
    case 'image/heic':
      return 'heic';
    case 'image/heif':
      return 'heif';
    default:
      return 'bin';
  }
}

export async function uploadListingPhotoAs(
  targetUid: string,
  propertyId: string,
  formData: FormData
): Promise<ActionResult<{ photoUrl: string; photoCount: number }>> {
  const adminSession = await requireAdminSession();

  const target = await loadManagedTarget(targetUid);
  if (!target.ok) return { ok: false, error: target.error };
  const { db } = target;

  if (typeof propertyId !== 'string' || !propertyId) {
    return { ok: false, error: 'Missing propertyId.' };
  }

  const file = formData.get('file');
  if (!(file instanceof File)) {
    return { ok: false, error: 'No file provided.' };
  }
  if (file.size === 0) {
    return { ok: false, error: 'File is empty.' };
  }
  if (file.size > MAX_PHOTO_BYTES) {
    return {
      ok: false,
      error: `File too large (${(file.size / 1024 / 1024).toFixed(1)} MB). Max 8 MB.`,
    };
  }
  if (!ALLOWED_PHOTO_MIME.has(file.type)) {
    return {
      ok: false,
      error: `Unsupported file type "${file.type}". Use JPEG, PNG, WebP, or HEIC.`,
    };
  }

  const propRef = db.collection('properties').doc(propertyId);
  const propSnap = await propRef.get();
  if (!propSnap.exists) return { ok: false, error: 'Property not found.' };
  const prop = propSnap.data() ?? {};
  if (prop.ownerId !== targetUid) {
    return {
      ok: false,
      error: 'Property is not owned by this partner.',
    };
  }

  // Write to Storage at HousePhoto/{propertyId}/{random}.{ext}. The path
  // is HousePhoto/ (legacy, NOT properties/.../photos) per backend_roome/
  // storage.rules §3 — the Flutter app writes here too, and the rules'
  // ownership check is keyed on it. Schema v2 §4.10 has an outdated
  // comment about the path; rules are the source of truth.
  const ext = extensionFor(file.type);
  const filename = `${crypto.randomBytes(12).toString('base64url')}.${ext}`;
  const objectPath = `HousePhoto/${propertyId}/${filename}`;

  let publicUrl: string;
  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    const bucket = serverStorage().bucket();
    const fileHandle = bucket.file(objectPath);
    // Firebase buckets default to Uniform Bucket-Level Access, which forbids
    // per-object ACLs — so `fileHandle.makePublic()` throws. The Flutter
    // client never uses ACLs either; it relies on the download-token URL
    // that Firebase Storage SDK returns from getDownloadURL(). We replicate
    // that exact URL shape by writing the token into custom metadata —
    // anyone with the token + the storage.rules read grant on
    // `HousePhoto/{propertyId}/...` can fetch the object.
    const downloadToken = crypto.randomUUID();
    await fileHandle.save(buffer, {
      contentType: file.type,
      metadata: {
        cacheControl: 'public, max-age=31536000, immutable',
        metadata: {
          firebaseStorageDownloadTokens: downloadToken,
          uploadedByAdminUid: adminSession.uid,
          uploadedForUid: targetUid,
          uploadedAt: new Date().toISOString(),
        },
      },
      resumable: false,
    });
    publicUrl =
      `https://firebasestorage.googleapis.com/v0/b/${bucket.name}` +
      `/o/${encodeURIComponent(objectPath)}?alt=media&token=${downloadToken}`;
  } catch (e) {
    console.error('[operate.uploadPhoto] Storage write failed:', e);
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, error: `Storage upload failed: ${msg}` };
  }

  // Append URL to the property + bump audit stamps.
  const now = FieldValue.serverTimestamp();
  await propRef.update({
    photoUrls: FieldValue.arrayUnion(publicUrl),
    updatedAt: now,
    _impersonatedByAdminUid: adminSession.uid,
    _impersonatedAt: now,
  });

  const existingCount = Array.isArray(prop.photoUrls) ? prop.photoUrls.length : 0;

  await recordAdminAction({
    adminUid: adminSession.uid,
    targetUid,
    action: 'notify',
    payload: {
      via: 'upload_photo_as',
      propertyId,
      photoUrl: publicUrl,
      sizeBytes: file.size,
      mimeType: file.type,
    },
  });

  revalidatePath(`/managed/${targetUid}/operate`);
  return {
    ok: true,
    photoUrl: publicUrl,
    photoCount: existingCount + 1,
  };
}

// ---------------------------------------------------------------------------
// T6 — Stripe state snapshot (read-only)
//
// Pulls everything the admin needs to know about this partner's Stripe
// footprint in a single server call: customer, owner subscription, Connect
// account, recent invoices, recent rent payments, recent disputes. Each
// section is fetched best-effort — if Stripe returns 4xx/5xx for one,
// that section surfaces an error string and the rest still renders.
//
// All reads. No writes. Cached implicitly by Next.js per-request; the page
// re-fetches on navigation.
// ---------------------------------------------------------------------------

export interface StripeCustomerSummary {
  customerId: string;
  email: string | null;
  name: string | null;
  created: number; // unix seconds
  defaultPaymentMethodId: string | null;
  dashboardUrl: string;
}

export interface StripeSubscriptionSummary {
  subscriptionId: string;
  status: string;
  currentPeriodStart: number;
  currentPeriodEnd: number;
  cancelAtPeriodEnd: boolean;
  canceledAt: number | null;
  amountCents: number;
  currency: string;
  collectionMethod: string;
  productId: string;
  priceId: string;
}

export interface StripeConnectSummary {
  accountId: string;
  type: string;
  country: string | null;
  chargesEnabled: boolean;
  payoutsEnabled: boolean;
  detailsSubmitted: boolean;
  capabilities: Record<string, string>;
  requirementsCurrentlyDue: string[];
  requirementsPastDue: string[];
  disabledReason: string | null;
  defaultPayoutInterval: string | null;
}

export interface StripeInvoiceSummary {
  invoiceId: string;
  number: string | null;
  status: string;
  amountPaid: number;
  amountRemaining: number;
  currency: string;
  created: number;
  hostedInvoiceUrl: string | null;
}

export interface StripePaymentIntentSummary {
  paymentIntentId: string;
  status: string;
  amount: number;
  currency: string;
  created: number;
  paymentMethodTypes: string[];
  description: string | null;
}

export interface StripeDisputeSummary {
  disputeId: string;
  status: string;
  reason: string;
  amount: number;
  currency: string;
  created: number;
  evidenceDueBy: number | null;
  charge: string | null;
}

export interface StripePartnerSnapshot {
  // Top-level identity
  hasStripeFootprint: boolean;
  // Per-section data + errors. Errors are surfaced as strings so the UI
  // can render a partial snapshot when one section fails.
  customer: StripeCustomerSummary | null;
  customerError: string | null;
  subscription: StripeSubscriptionSummary | null;
  subscriptionError: string | null;
  connect: StripeConnectSummary | null;
  connectError: string | null;
  invoices: StripeInvoiceSummary[];
  invoicesError: string | null;
  payments: StripePaymentIntentSummary[];
  paymentsError: string | null;
  disputes: StripeDisputeSummary[];
  disputesError: string | null;
}

function dashboardBase(accountId?: string): string {
  // Stripe dashboard URLs are mode-aware. We can't reliably detect test vs
  // live from the SDK without an extra call; default to `/test/` since the
  // admin-panel deployment points at the test secret. If the project goes
  // live, swap this to '/'. (Or read STRIPE_SECRET_KEY's `sk_live_` prefix
  // at runtime — TODO when live mode lands.)
  const isLive = (process.env.STRIPE_SECRET_KEY || '').startsWith('sk_live_');
  const acct = accountId ? `${accountId}/` : '';
  return `https://dashboard.stripe.com/${acct}${isLive ? '' : 'test/'}`;
}

export async function getStripePartnerSnapshot(
  targetUid: string
): Promise<ActionResult<{ snapshot: StripePartnerSnapshot }>> {
  await requireAdminSession();

  const target = await loadManagedTarget(targetUid);
  // Note: loadManagedTarget refuses on suspended/archived/non-managed.
  // The snapshot is useful even for those states though — let's relax
  // the gate here by reading the user doc directly.
  let userData: FirebaseFirestore.DocumentData = {};
  if (target.ok) {
    userData = target.data;
  } else {
    const snap = await serverDb().collection('users').doc(targetUid).get();
    if (!snap.exists) return { ok: false, error: 'User not found.' };
    userData = snap.data() ?? {};
  }

  const customerId =
    typeof userData.stripeCustomerId === 'string'
      ? userData.stripeCustomerId
      : null;
  const connectAccountId =
    typeof userData.stripeConnectAccountId === 'string'
      ? userData.stripeConnectAccountId
      : null;
  const subscriptionId =
    typeof userData.ownerSubscription?.stripeSubscriptionId === 'string'
      ? userData.ownerSubscription.stripeSubscriptionId
      : null;

  const snapshot: StripePartnerSnapshot = {
    hasStripeFootprint: Boolean(customerId || connectAccountId),
    customer: null,
    customerError: null,
    subscription: null,
    subscriptionError: null,
    connect: null,
    connectError: null,
    invoices: [],
    invoicesError: null,
    payments: [],
    paymentsError: null,
    disputes: [],
    disputesError: null,
  };

  if (!snapshot.hasStripeFootprint) {
    return { ok: true, snapshot };
  }

  const stripe = serverStripe();

  // Build all the section fetches and run them in parallel. Each catches
  // its own error so one failure doesn't take down the whole snapshot.
  const tasks: Promise<void>[] = [];

  if (customerId) {
    tasks.push(
      stripe.customers
        .retrieve(customerId, { expand: ['invoice_settings.default_payment_method'] })
        .then((c) => {
          if (c.deleted) {
            snapshot.customerError = 'Customer is deleted in Stripe.';
            return;
          }
          snapshot.customer = {
            customerId: c.id,
            email: c.email ?? null,
            name: c.name ?? null,
            created: c.created,
            defaultPaymentMethodId:
              typeof c.invoice_settings?.default_payment_method === 'string'
                ? c.invoice_settings.default_payment_method
                : (c.invoice_settings?.default_payment_method as
                    | { id: string }
                    | null)?.id ?? null,
            dashboardUrl: `${dashboardBase()}customers/${c.id}`,
          };
        })
        .catch((e) => {
          snapshot.customerError = e instanceof Error ? e.message : String(e);
        })
    );

    // Recent invoices for the customer (any subscription, includes the
    // €150/yr owner-sub + any one-off invoices).
    tasks.push(
      stripe.invoices
        .list({ customer: customerId, limit: 12 })
        .then((page) => {
          snapshot.invoices = page.data.map((inv) => ({
            invoiceId: inv.id || '',
            number: inv.number ?? null,
            status: inv.status ?? 'unknown',
            amountPaid: inv.amount_paid ?? 0,
            amountRemaining: inv.amount_remaining ?? 0,
            currency: inv.currency ?? 'eur',
            created: inv.created ?? 0,
            hostedInvoiceUrl: inv.hosted_invoice_url ?? null,
          }));
        })
        .catch((e) => {
          snapshot.invoicesError = e instanceof Error ? e.message : String(e);
        })
    );

    // Recent PaymentIntents — covers rent payments + anything else.
    tasks.push(
      stripe.paymentIntents
        .list({ customer: customerId, limit: 12 })
        .then((page) => {
          snapshot.payments = page.data.map((pi) => ({
            paymentIntentId: pi.id,
            status: pi.status,
            amount: pi.amount,
            currency: pi.currency,
            created: pi.created,
            paymentMethodTypes: pi.payment_method_types ?? [],
            description: pi.description ?? null,
          }));
        })
        .catch((e) => {
          snapshot.paymentsError = e instanceof Error ? e.message : String(e);
        })
    );
  }

  if (subscriptionId) {
    tasks.push(
      stripe.subscriptions
        .retrieve(subscriptionId, { expand: ['items.data.price.product'] })
        .then((sub) => {
          const item = sub.items.data[0];
          const price = item?.price as { id: string; product: string | { id: string }; unit_amount: number | null; currency: string } | undefined;
          const productId =
            typeof price?.product === 'string'
              ? price.product
              : (price?.product as { id: string } | undefined)?.id ?? '';
          // current_period_start / end live on subscription items in v2 API.
          const cps = (sub as unknown as { current_period_start?: number }).current_period_start ??
            (item as unknown as { current_period_start?: number })?.current_period_start ?? 0;
          const cpe = (sub as unknown as { current_period_end?: number }).current_period_end ??
            (item as unknown as { current_period_end?: number })?.current_period_end ?? 0;
          snapshot.subscription = {
            subscriptionId: sub.id,
            status: sub.status,
            currentPeriodStart: cps,
            currentPeriodEnd: cpe,
            cancelAtPeriodEnd: sub.cancel_at_period_end,
            canceledAt: sub.canceled_at,
            amountCents: price?.unit_amount ?? 0,
            currency: price?.currency ?? 'eur',
            collectionMethod: sub.collection_method,
            productId,
            priceId: price?.id ?? '',
          };
        })
        .catch((e) => {
          snapshot.subscriptionError = e instanceof Error ? e.message : String(e);
        })
    );
  }

  if (connectAccountId) {
    tasks.push(
      stripe.accounts
        .retrieve(connectAccountId)
        .then((acct) => {
          // Stripe-Node's `requirements` type is conservatively `{}` when
          // unset, so we widen at the boundary. All fields are optional
          // per the Stripe API.
          const reqs = (acct.requirements ?? {}) as {
            currently_due?: string[];
            past_due?: string[];
            disabled_reason?: string | null;
          };
          // capabilities is an object whose values are status strings
          // ('active' / 'pending' / 'inactive'). Normalize to a flat map.
          const caps: Record<string, string> = {};
          for (const [k, v] of Object.entries(acct.capabilities ?? {})) {
            if (typeof v === 'string') caps[k] = v;
          }
          snapshot.connect = {
            accountId: acct.id,
            type: acct.type ?? 'unknown',
            country: acct.country ?? null,
            chargesEnabled: acct.charges_enabled === true,
            payoutsEnabled: acct.payouts_enabled === true,
            detailsSubmitted: acct.details_submitted === true,
            capabilities: caps,
            requirementsCurrentlyDue: Array.isArray(reqs.currently_due)
              ? reqs.currently_due
              : [],
            requirementsPastDue: Array.isArray(reqs.past_due) ? reqs.past_due : [],
            disabledReason:
              typeof reqs.disabled_reason === 'string'
                ? reqs.disabled_reason
                : null,
            defaultPayoutInterval:
              acct.settings?.payouts?.schedule?.interval ?? null,
          };
        })
        .catch((e) => {
          snapshot.connectError = e instanceof Error ? e.message : String(e);
        })
    );

    // Disputes are scoped to the Connect account (chargebacks land on the
    // connected account when on_behalf_of is set on the PaymentIntent).
    tasks.push(
      stripe.disputes
        .list({ limit: 5 }, { stripeAccount: connectAccountId })
        .then((page) => {
          snapshot.disputes = page.data.map((d) => ({
            disputeId: d.id,
            status: d.status,
            reason: d.reason,
            amount: d.amount,
            currency: d.currency,
            created: d.created,
            evidenceDueBy: d.evidence_details?.due_by ?? null,
            charge: typeof d.charge === 'string' ? d.charge : d.charge?.id ?? null,
          }));
        })
        .catch((e) => {
          snapshot.disputesError = e instanceof Error ? e.message : String(e);
        })
    );
  }

  await Promise.all(tasks);

  return { ok: true, snapshot };
}
