import type { FamilyMember, UserRole } from '../types/roles';
import { normalizeRole, UserRole as UR } from '../types/roles';

export interface MemberNavTarget {
  screen: 'EditGuardian' | 'FamilySharing';
  params?: Record<string, any>;
  /** What to show the user if they can't edit (for a toast). */
  readOnlyReason?: string;
}

/**
 * Decide where to send the user when they tap a family member on
 * ANY screen that isn't already inside the Family management flow.
 *
 * Rules (mirrors the MoreScreen / FamilySharing behaviour):
 *   • Tapping *yourself*                       → edit my profile
 *                                                (mode: parent1 or parent2,
 *                                                 guardianId = my userId)
 *   • Tapping Parent 1 or Parent 2             → EditGuardian as that member
 *     (when I'm Parent 1 or Parent 2)          (guarded: caller must be a parent)
 *   • Tapping a Guardian or Viewer             → EditGuardian as guardian
 *     (when I'm Parent 1 or Parent 2)
 *   • I'm a Guardian / Viewer                  → open FamilySharing (read-only)
 *
 * `resolveTargetId()` picks `userId` (profile UUID) over `id`
 * (family_members row id) because `EditGuardian` resolves the row via
 * `userId` first, then falls back to `id`.
 */
export const resolveTargetId = (member: FamilyMember): string => {
  const m = member as any;
  return String(m.userId || m.id || '');
};

export const getMemberNavTarget = (
  target: FamilyMember,
  currentUserId: string,
  currentUserRole: UserRole | string | null | undefined,
): MemberNavTarget => {
  const targetId = resolveTargetId(target);
  const targetRole = normalizeRole((target as any).role);
  const myRole = normalizeRole(currentUserRole);
  const isMe = targetId === currentUserId || (target as any).id === currentUserId;

  // 1) Tapping myself → edit my own profile.
  if (isMe) {
    // Use the role I have *on this baby* to pick the mode:
    //   parent1 / parent2 → 'parent2' mode (EditGuardian handles both
    //                       parent role edits through the same form)
    //   guardian / viewer → 'guardian' mode
    const editMode: 'parent2' | 'guardian' =
      myRole === UR.PARENT_1 || myRole === UR.PARENT_2
        ? 'parent2'
        : 'guardian';
    return {
      screen: 'EditGuardian',
      params: {
        guardianId: targetId,
        mode: editMode,
        fromChat: false,
      },
    };
  }

  // 2) Non-parents can't edit anyone else → read-only family view.
  const iAmParent = myRole === UR.PARENT_1 || myRole === UR.PARENT_2;
  if (!iAmParent) {
    return {
      screen: 'FamilySharing',
      params: {},
      readOnlyReason:
        'Only Primary Parent or Co-Parent can edit family members.',
    };
  }

  // 3) I'm a parent, tapping someone else. Pick the mode by THEIR role.
  const editMode: 'parent2' | 'guardian' =
    targetRole === UR.PARENT_1 || targetRole === UR.PARENT_2
      ? 'parent2'
      : 'guardian';

  return {
    screen: 'EditGuardian',
    params: {
      guardianId: targetId,
      mode: editMode,
      fromChat: false,
    },
  };
};