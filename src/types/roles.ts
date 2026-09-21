// src/types/roles.ts
// ─────────────────────────────────────────────────────────────────────
// Role and permission definitions.
//
// FIXES:
//   ✓ Extended Permission type with granular keys
//   ✓ Backward compatible — old `read/write/delete/manageFamily`
//     flags still exist and default to true for parent roles
//   ✓ ROLE_PERMISSIONS now includes all granular keys
// ─────────────────────────────────────────────────────────────────────

export enum UserRole {
  PARENT_1 = 'parent1',
  PARENT_2 = 'parent2',
  GUARDIAN = 'guardian',
  VIEWER = 'viewer',
}

// ─── Extended Permission Shape ──────────────────────────────────────
// Legacy keys (read/write/delete/manageFamily/manageSecurity/exportData)
// are kept for backward compatibility with existing code that reads them.
// Granular keys are the new source of truth when present.

export interface Permission {
  // ─── Legacy (still used by existing code) ──────────────────────
  read: boolean;
  write: boolean;
  delete: boolean;
  manageFamily: boolean;
  manageSecurity: boolean;
  exportData: boolean;

  // ─── Granular (new — mirrors family_members.permissions JSON) ──
  canView?: boolean;
  canAddEntry?: boolean;
  canEditEntry?: boolean;
  canEditOthersEntries?: boolean;
  canDeleteEntry?: boolean;
  canEditBaby?: boolean;
  canInvite?: boolean;
  canExport?: boolean;
  canManageFamily?: boolean;
}

// ─── Role Default Permissions ───────────────────────────────────────

export const ROLE_PERMISSIONS: Record<UserRole, Permission> = {
  [UserRole.PARENT_1]: {
    // Legacy
    read: true,
    write: true,
    delete: true,
    manageFamily: true,
    manageSecurity: true,
    exportData: true,
    // Granular
    canView: true,
    canAddEntry: true,
    canEditEntry: true,
    canEditOthersEntries: true,
    canDeleteEntry: true,
    canEditBaby: true,
    canInvite: true,
    canExport: true,
    canManageFamily: true,
  },
  [UserRole.PARENT_2]: {
    read: true,
    write: true,
    delete: true,
    manageFamily: true,
    manageSecurity: false,
    exportData: true,
    canView: true,
    canAddEntry: true,
    canEditEntry: true,
    canEditOthersEntries: true,
    canDeleteEntry: true,
    canEditBaby: true,
    canInvite: true,
    canExport: true,
    canManageFamily: true,
  },
  [UserRole.GUARDIAN]: {
    read: true,
    write: true,
    delete: false,
    manageFamily: false,
    manageSecurity: false,
    exportData: false,
    canView: true,
    canAddEntry: true,
    canEditEntry: true,
    canEditOthersEntries: false,
    canDeleteEntry: false,
    canEditBaby: false,
    canInvite: false,
    canExport: false,
    canManageFamily: false,
  },
  [UserRole.VIEWER]: {
    read: true,
    write: false,
    delete: false,
    manageFamily: false,
    manageSecurity: false,
    exportData: false,
    canView: true,
    canAddEntry: false,
    canEditEntry: false,
    canEditOthersEntries: false,
    canDeleteEntry: false,
    canEditBaby: false,
    canInvite: false,
    canExport: false,
    canManageFamily: false,
  },
};

// ─── Labels & Colors ────────────────────────────────────────────────

export const ROLE_LABELS: Record<UserRole, string> = {
  [UserRole.PARENT_1]: 'Primary Parent',
  [UserRole.PARENT_2]: 'Co-Parent',
  [UserRole.GUARDIAN]: 'Guardian',
  [UserRole.VIEWER]: 'Viewer',
};

export const ROLE_COLORS: Record<UserRole, string> = {
  [UserRole.PARENT_1]: '#667eea',
  [UserRole.PARENT_2]: '#fa709a',
  [UserRole.GUARDIAN]: '#11998e',
  [UserRole.VIEWER]: '#64748b',
};

// ─── FamilyMember Shape ─────────────────────────────────────────────

export interface FamilyMember {
  id: string;
  userId: string;
  fullName: string;
  email: string;
  avatar?: string;
  role: UserRole;
  relationship: string;
  permissions: Permission;
  addedAt: string;
  addedBy: string;
  lastActive?: string;
  canBeRemoved: boolean;
  phoneNumber?: string;
  notificationsEnabled?: boolean;
  status?: 'active' | 'pending' | 'rejected';
}