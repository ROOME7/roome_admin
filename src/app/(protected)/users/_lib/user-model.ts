// Shared helpers for the Users section — classification + row mapping.
//
// The `users/{uid}` schema is mixed: every account written by the Flutter
// signup flow carries a legacy `role` ('tenant' | 'owner') plus, for
// owners, an `ownerType` ('b2c' | 'b2b'); the splitUserOnWrite Cloud
// Function additionally derives a v2 `roles` array. classify() reads all
// of them so the panel is correct regardless of which a given doc has.

import type { Timestamp } from 'firebase-admin/firestore';
import type { TFunc } from '@/i18n/t';

export function tsToDate(value: unknown): Date | null {
  if (!value) return null;
  if (value instanceof Date) return value;
  if (typeof value === 'object' && value !== null && 'toDate' in value) {
    try {
      return (value as Timestamp).toDate();
    } catch {
      return null;
    }
  }
  return null;
}

export type UserKind = 'tenant' | 'landlord' | 'other';
export type OwnerType = 'b2c' | 'b2b' | null;
export type UserStatus = 'active' | 'suspended' | 'archived';

/** Tab values for the /users list filter. */
export type RoleFilter = 'all' | 'tenant' | 'landlord';

export function asRoleFilter(raw: string | string[] | undefined): RoleFilter {
  const v = Array.isArray(raw) ? raw[0] : raw;
  return v === 'tenant' || v === 'landlord' ? v : 'all';
}

/** Classifies a user doc into tenant / landlord (+ owner sub-type). */
export function classify(d: FirebaseFirestore.DocumentData): {
  kind: UserKind;
  ownerType: OwnerType;
} {
  const roles = Array.isArray(d.roles)
    ? (d.roles.filter((r): r is string => typeof r === 'string'))
    : [];
  const role = typeof d.role === 'string' ? d.role : '';
  const ownerTypeRaw =
    typeof d.ownerType === 'string' ? d.ownerType.toLowerCase() : '';

  const isOwner =
    role === 'owner' || roles.some((r) => r.startsWith('owner'));
  const isTenant = role === 'tenant' || roles.includes('tenant');

  if (isOwner) {
    let ownerType: OwnerType = 'b2c';
    if (ownerTypeRaw === 'b2b' || roles.includes('owner_b2b')) {
      ownerType = 'b2b';
    }
    return { kind: 'landlord', ownerType };
  }
  if (isTenant) return { kind: 'tenant', ownerType: null };
  return { kind: 'other', ownerType: null };
}

export function deriveStatus(d: FirebaseFirestore.DocumentData): UserStatus {
  if (d.deletedAt) return 'archived';
  if (d.suspended && d.suspended.active === true) return 'suspended';
  return 'active';
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
  managed: boolean;
}

const str = (v: unknown): string | null =>
  typeof v === 'string' && v.trim().length > 0 ? v.trim() : null;

export function mapUserRow(
  uid: string,
  d: FirebaseFirestore.DocumentData
): UserRow {
  const { kind, ownerType } = classify(d);
  const name = str(d.name);
  const surname = str(d.surname);
  const fullName =
    str(d.fullName) ?? ([name, surname].filter(Boolean).join(' ') || null);
  return {
    uid,
    email: str(d.email) ?? '',
    displayName: str(d.displayUsername) ?? str(d.username) ?? '(unnamed)',
    fullName,
    photoUrl: str(d.photoUrl) ?? str(d.profilePicture),
    kind,
    ownerType,
    companyName: str(d.companyName),
    phoneNumber: str(d.phoneNumber),
    createdAt: tsToDate(d.createdAt),
    emailVerified: d.emailVerified === true,
    profileCompleted: d.profileCompleted === true,
    status: deriveStatus(d),
    managed: typeof d.managedBy === 'string' && d.managedBy.length > 0,
  };
}

/** Human label for a user's role/type, e.g. "Landlord · B2B". */
export function roleLabel(kind: UserKind, ownerType: OwnerType, t: TFunc): string {
  if (kind === 'tenant') return t('common.roleTenant');
  if (kind === 'landlord') {
    return ownerType === 'b2b' ? t('common.roleLandlordB2b') : t('common.roleLandlordB2c');
  }
  return t('common.roleOther');
}
