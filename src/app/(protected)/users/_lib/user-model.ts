// The shape the Users screens render, and the mapping from the API to it.
//
// ⚠️ THIS USED TO MAP FIRESTORE DOCUMENTS. The old version read raw
// `DocumentData` and derived everything client-side — the role from two
// fields, the status from a `suspended.active` sub-object, `managed` from the
// presence of a `managedBy` string. All of that now arrives already decided by
// the API, which is the right place for it: two clients deriving "is this
// account usable" from the same nullable timestamps will eventually disagree.

import type { TFunc } from '@/i18n/t';

export type UserKind = 'tenant' | 'landlord' | 'other';
export type OwnerType = 'b2c' | 'b2b' | null;
export type UserStatus = 'active' | 'suspended' | 'archived';

export type RoleFilter = 'all' | 'tenant' | 'landlord';

export function asRoleFilter(raw: string | string[] | undefined): RoleFilter {
  const v = Array.isArray(raw) ? raw[0] : raw;
  return v === 'tenant' || v === 'landlord' ? v : 'all';
}

/** The panel's vocabulary → the API's. `landlord` is `owner` on the wire. */
export function roleFilterToApi(role: RoleFilter): string | undefined {
  if (role === 'tenant') return 'tenant';
  if (role === 'landlord') return 'owner';
  return undefined;
}

/** One row of `GET /admin/users`. */
export interface ApiUser {
  id: string;
  email: string;
  username: string;
  fullName: string | null;
  photoUrl: string | null;
  role: string;
  ownerKind: string | null;
  companyName: string | null;
  vatNumber: string | null;
  phoneNumber: string | null;
  emailVerified: boolean;
  profileCompleted: boolean;
  identityStatus: string;
  status: string;
  suspendedReason: string | null;
  averageRating: number;
  reviewCount: number;
  createdAt: string;
  lastSeenAt: string | null;
}

/** A block counterparty, name already resolved by the API. */
export interface ApiParty {
  id: string;
  username: string;
  fullName: string | null;
  createdAt: string;
}

/**
 * `GET /admin/users/{id}` — the list row plus everything that lives in a
 * satellite table. Every field is optional-safe on the client: the detail page
 * renders an em-dash for anything absent rather than assuming the API version
 * it was written against is the one deployed.
 */
export interface ApiUserDetail extends ApiUser {
  birthDate: string | null;
  gender: string | null;
  bio: string | null;
  bioModeratedAt: string | null;
  locale: string;
  authProvider: string;
  roleConfirmedAt: string | null;

  identityVerifiedAt: string | null;
  identityFailureReason: string | null;
  verifiedOwner: boolean;
  verifiedTenant: boolean;

  consent: {
    version: string | null;
    acceptedAt: string | null;
    confirmedAge18: boolean;
    messaging: boolean;
    messagingAt: string | null;
  };

  suspendedAt: string | null;
  deletedAt: string | null;
  purgeAt: string | null;
  updatedAt: string;

  tenantProfile: {
    universityName: string | null;
    profession: string | null;
    professionalArea: string | null;
    cleanlinessLevel: number | null;
    noiseLevel: number | null;
    sleepSchedule: number | null;
    sociability: number | null;
    guests: number | null;
    isSmoker: boolean | null;
    hasPets: boolean | null;
    cooksOften: boolean | null;
  } | null;

  ownerProfile: {
    companyName: string | null;
    vatNumber: string | null;
    fiscalCode: string | null;
    pec: string | null;
    adminName: string | null;
  } | null;

  b2bRequest: {
    ticketRef: string;
    status: string;
    companyName: string | null;
    vatNumber: string | null;
    pec: string | null;
    adminName: string | null;
    phoneNumber: string | null;
    notes: string | null;
    reviewedAt: string | null;
    createdAt: string;
  } | null;

  /** Identifiers and state only — this panel never operates Stripe. */
  stripe: {
    mode: string | null;
    customerId: string | null;
    connect: {
      accountId: string;
      chargesEnabled: boolean;
      payoutsEnabled: boolean;
      rejected: boolean;
      disabledReason: string | null;
      requirementsDue: string[];
      onboardingStatus: string | null;
    } | null;
    subscription: {
      id: string;
      status: string;
      interval: string;
      currentPeriodEnd: string | null;
      cancelAtPeriodEnd: boolean;
      waiverActive: boolean;
    } | null;
  };

  counts: {
    properties: number;
    contractsAsTenant: number;
    contractsAsLandlord: number;
    reportsAgainst: number;
    reportsMade: number;
    blocksMade: number;
    blocksReceived: number;
  };

  /** Capped at 50 rows each — `counts` carries the true total. */
  blocks: { made: ApiParty[]; received: ApiParty[] };
}

export interface UserRow {
  uid: string;
  email: string;
  displayName: string;
  fullName: string | null;
  photoUrl: string | null;
  kind: UserKind;
  ownerType: OwnerType;
  companyName: string | null;
  phoneNumber: string | null;
  createdAt: Date | null;
  emailVerified: boolean;
  profileCompleted: boolean;
  status: UserStatus;
  /**
   * ⚠️ ALWAYS FALSE FOR NOW, AND THAT IS NOT AN OVERSIGHT. There is no
   * managed-owner concept in the new database — the old flag read a Firestore
   * `managedBy` field with no equivalent. Left in the type so the Active
   * Management screen keeps compiling until its data model is designed.
   */
  managed: boolean;
}

export function mapApiUser(u: ApiUser): UserRow {
  return {
    uid: u.id,
    email: u.email,
    // The API always has a username; the old panel fell back through two
    // fields and then to "(unnamed)" because Firestore sometimes had neither.
    displayName: u.username || u.email || '(unnamed)',
    fullName: u.fullName,
    photoUrl: u.photoUrl,
    kind: kindOf(u.role),
    ownerType: ownerTypeOf(u.ownerKind),
    companyName: u.companyName,
    phoneNumber: u.phoneNumber,
    createdAt: u.createdAt ? new Date(u.createdAt) : null,
    emailVerified: u.emailVerified,
    profileCompleted: u.profileCompleted,
    status: statusOf(u.status),
    managed: false,
  };
}

export function kindOf(role: string): UserKind {
  const r = role?.toLowerCase();
  if (r === 'tenant') return 'tenant';
  if (r === 'owner') return 'landlord';
  return 'other';
}

/** `institutional` is the API's word for what this panel calls B2B. */
export function ownerTypeOf(ownerKind: string | null): OwnerType {
  const k = ownerKind?.toLowerCase();
  if (k === 'institutional') return 'b2b';
  if (k === 'individual') return 'b2c';
  return null;
}

/** The API says `deleted`; this panel has always called that `archived`. */
export function statusOf(status: string): UserStatus {
  const s = status?.toLowerCase();
  if (s === 'suspended') return 'suspended';
  if (s === 'deleted' || s === 'archived') return 'archived';
  return 'active';
}

/** Human label for a user's role/type, e.g. "Landlord · B2B". */
export function roleLabel(kind: UserKind, ownerType: OwnerType, t: TFunc): string {
  if (kind === 'tenant') return t('common.roleTenant');
  if (kind === 'landlord') {
    return ownerType === 'b2b' ? t('common.roleLandlordB2b') : t('common.roleLandlordB2c');
  }
  return t('common.roleOther');
}
