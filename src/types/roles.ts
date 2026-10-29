










export enum UserRole {
  PARENT_1 = 'parent1',
  PARENT_2 = 'parent2',
  GUARDIAN = 'guardian',
  VIEWER = 'viewer',
}






export interface Permission {
  
  read: boolean;
  write: boolean;
  delete: boolean;
  manageFamily: boolean;
  manageSecurity: boolean;
  exportData: boolean;

  
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



export const ROLE_PERMISSIONS: Record<UserRole, Permission> = {
  [UserRole.PARENT_1]: {
    
    read: true,
    write: true,
    delete: true,
    manageFamily: true,
    manageSecurity: true,
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

// ─────────────────────────────────────────────────────────────────────
// DISPLAY NAMING — Mother / Father / Guardian etc.
// ─────────────────────────────────────────────────────────────────────
// `role` is a *permission* concept (parent1/parent2). `relationship`
// is the *human* concept (Mother, Father, Grandma, Nanny…). We surface
// the human label everywhere, never "Parent 1".
//
// The canonical relationship label:
//   1. `relationship` (the free-text entered when inviting) if set
//   2. derived from role + gender hint (if the user filled it in)
//   3. fallback: "Primary Parent" / "Co-Parent" / "Guardian" / "Viewer"
// ─────────────────────────────────────────────────────────────────────

const RELATIONSHIP_CANONICAL: Record<string, string> = {
  mother: 'Mother',
  mom: 'Mother',
  mum: 'Mother',
  mama: 'Mother',
  father: 'Father',
  dad: 'Father',
  papa: 'Father',
  daddy: 'Father',
  grandmother: 'Grandmother',
  grandma: 'Grandmother',
  granny: 'Grandmother',
  grandfather: 'Grandfather',
  grandpa: 'Grandfather',
  nanny: 'Nanny',
  aunt: 'Aunt',
  uncle: 'Uncle',
  sister: 'Sister',
  brother: 'Brother',
  guardian: 'Guardian',
  caregiver: 'Caregiver',
  sitter: 'Babysitter',
  babysitter: 'Babysitter',
  parent: 'Parent',
};

export const canonicalizeRelationship = (raw?: string | null): string => {
  if (!raw) return '';
  const key = raw.trim().toLowerCase();
  return RELATIONSHIP_CANONICAL[key] || (raw.trim().charAt(0).toUpperCase() + raw.trim().slice(1));
};

/**
 * The label to display for a member in ANY UI. Uses the human relationship
 * ("Mother", "Father", "Grandma") and never "Parent 1".
 */
export const getMemberDisplayLabel = (member: {
  role?: UserRole | string;
  relationship?: string;
}): string => {
  const relationship = canonicalizeRelationship(member?.relationship);
  if (relationship) return relationship;
  switch (member?.role) {
    case UserRole.PARENT_1:
    case 'parent1':
      return 'Primary Parent';
    case UserRole.PARENT_2:
    case 'parent2':
      return 'Co-Parent';
    case UserRole.GUARDIAN:
    case 'guardian':
      return 'Guardian';
    case UserRole.VIEWER:
    case 'viewer':
      return 'Viewer';
    default:
      return 'Family Member';
  }
};

/**
 * Role that this member is *allowed to remove*. Rule:
 *   • Primary Parent (parent1) → can remove anyone EXCEPT themselves
 *     and EXCEPT their own inviter (the person who upgraded them).
 *     We DON'T know the inviter in this helper — enforce at
 *     FamilyContext level where `addedBy` is available.
 *   • Co-Parent (parent2) → can remove guardians/viewers but NOT the
 *     primary parent and NOT themselves.
 *   • Guardian / Viewer → cannot remove anyone.
 */
export const canRoleRemove = (actorRole: UserRole | string): boolean => {
  return actorRole === UserRole.PARENT_1 || actorRole === UserRole.PARENT_2 ||
    actorRole === 'parent1' || actorRole === 'parent2';
};

export const canRoleChangeRoles = (actorRole: UserRole | string): boolean => {
  return actorRole === UserRole.PARENT_1 || actorRole === 'parent1';
};