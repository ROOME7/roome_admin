// Shared types for the Active Management flow. Server-only.

// Order matters: archived overrides suspended overrides handed_over
// overrides active. Use deriveStatus() to compute from the user doc.
export type ManagedStatus = 'active' | 'suspended' | 'handed_over' | 'archived';
export type OwnerType = 'owner_b2c' | 'owner_b2b';

export const ALL_FILTERS = [
  'active',
  'suspended',
  'handed_over',
  'archived',
  'all',
] as const;
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
  adminNotes: string | null;
  adminNotesUpdatedAt: Date | null;
  adminNotesUpdatedByUid: string | null;
  adminTags: string[];
  // T2 lifecycle state
  suspendedActive: boolean;
  suspendedReason: string | null;
  suspendedAt: Date | null;
  deletedAt: Date | null;
  deletionReason: string | null;
  // T4 admin powers state
  subscriptionWaiverActive: boolean;
  subscriptionWaiverReason: string | null;
  stripeConnectAccountId: string | null;
  connectChargesEnabled: boolean;
  hasOwnerSubscription: boolean;
}
