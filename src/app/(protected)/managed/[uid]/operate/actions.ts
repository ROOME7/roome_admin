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

export type { ActionResult };

// ---------------------------------------------------------------------------
// Item 11-T3B: publishListingAs
//
// What we actually create here is a *property* (+ its rooms subcollection)
// with isOnMarket=true. The `listings/{id}` doc itself is auto-built by
// the syncListingOnPropertyWrite Cloud Function — listings are derived
// from property+rooms, not authored independently.
//
// Audit stamps land on:
//   - properties/{propertyId} itself
//   - each properties/{propertyId}/rooms/{roomId} subdoc
// They will NOT automatically end up on the derived listing doc — the
// rebuild fn doesn't know about them — but the property doc IS the source
// of truth, and any later listing edit goes through updateListingAs which
// stamps the listing doc directly.
// ---------------------------------------------------------------------------

export interface RoomInput {
  type: 'single' | 'double' | 'master';
  pricePerPersonCents: number;
  condoFeesCents?: number;
  bedCount: number;
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

  const batch = db.batch();
  batch.set(propRef, {
    propertyId,
    ownerId: targetUid,
    address: {
      street: input.street.trim(),
      streetNumber: input.streetNumber.trim(),
      postalCode: input.postalCode.trim(),
      city: input.city.trim(),
      province: input.province.trim(),
      region: input.region.trim(),
      neighborhood: input.neighborhood?.trim() || null,
      country: 'IT',
    },
    location: null,
    propertyType: input.propertyType,
    floor: typeof input.floor === 'number' ? input.floor : null,
    hasElevator: null,
    yearBuilt: null,
    totalSquareMeters: null,
    totalRooms,
    totalBeds,
    totalBathrooms: input.totalBathrooms,
    description: input.description.trim().slice(0, 5_000),
    photoUrls: [],
    // Listing-level convenience denorm — read by _rebuildListingForProperty.
    // Kept on the property so the Cloud Function trigger needs no extra
    // reads.
    isOnMarket: true,
    inAppRentPaymentEnabled: input.inAppRentPaymentEnabled,
    rentDueDayOfMonth: input.inAppRentPaymentEnabled
      ? input.rentDueDayOfMonth
      : null,
    region: input.region.trim(),
    province: input.province.trim(),
    neighborhood: input.neighborhood?.trim() || null,
    city: input.city.trim(),
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
    _impersonatedByAdminUid: adminSession.uid,
    _impersonatedAt: now,
  });

  for (const r of input.rooms) {
    const roomRef = propRef.collection('rooms').doc();
    batch.set(roomRef, {
      roomId: roomRef.id,
      type: r.type,
      pricePerPersonCents: r.pricePerPersonCents,
      condoFeesCents: r.condoFeesCents ?? 0,
      status: 'available',
      bedCount: r.bedCount,
      occupants: [],
      description: r.description?.trim().slice(0, 2_000) || null,
      photoUrls: [],
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
    await fileHandle.save(buffer, {
      contentType: file.type,
      metadata: {
        cacheControl: 'public, max-age=31536000, immutable',
        metadata: {
          uploadedByAdminUid: adminSession.uid,
          uploadedForUid: targetUid,
          uploadedAt: new Date().toISOString(),
        },
      },
      resumable: false,
    });
    // Make object publicly readable so partner + tenants can render it
    // without signed URLs. Matches the existing photoUrls[] convention.
    await fileHandle.makePublic();
    publicUrl = `https://storage.googleapis.com/${bucket.name}/${objectPath}`;
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
