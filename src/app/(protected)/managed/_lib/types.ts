// Shared types for the Active Management flow. Server-only.

export type ManagedStatus = 'active' | 'handed_over';
export type OwnerType = 'owner_b2c' | 'owner_b2b';

export const ALL_FILTERS = ['active', 'handed_over', 'all'] as const;
export type FilterValue = (typeof ALL_FILTERS)[number];

export function asFilter(raw: string | string[] | undefined): FilterValue {
  const v = Array.isArray(raw) ? raw[0] : raw;
  return (ALL_FILTERS as readonly string[]).includes(v ?? '')
    ? (v as FilterValue)
    : 'active';
}

export interface ManagedAccount {
  uid: string;
  email: string;
  displayUsername: string;
  fullName: string | null;
  ownerType: OwnerType;
  companyName: string | null;
  vatNumber: string | null;
  pec: string | null;
  phoneNumber: string | null;
  managedBy: string | null;
  managedAt: Date | null;
  managementHandedOverAt: Date | null;
  managementHandedOverByAdminUid: string | null;
  status: ManagedStatus;
}
