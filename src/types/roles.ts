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
}

export const ROLE_PERMISSIONS: Record<UserRole, Permission> = {
  [UserRole.PARENT_1]: {
    read: true,
    write: true,
    delete: true,
    manageFamily: true,
    manageSecurity: true,
    exportData: true,
  },
  [UserRole.PARENT_2]: {
    read: true,
    write: true,
    delete: true,
    manageFamily: true,
    manageSecurity: false,
    exportData: true,
  },
  [UserRole.GUARDIAN]: {
    read: true,
    write: true,
    delete: false,
    manageFamily: false,
    manageSecurity: false,
    exportData: false,
  },
  [UserRole.VIEWER]: {
    read: true,
    write: false,
    delete: false,
    manageFamily: false,
    manageSecurity: false,
    exportData: false,
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
}
