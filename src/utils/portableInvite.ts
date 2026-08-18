import { supabase } from '@/utils/supabase';

/* ============================================================
   TYPES
   ============================================================ */

export interface PortableInvitePayload {
  familyId: string; // babyId
  babyName: string;
  babyDob?: string;
  babyGender?: string;
  creatorId: string;
  creatorName: string;
  role: 'parent2' | 'guardian' | 'viewer';
  relationship?: string;
  createdAt: number;
  expiresInDays: number;
}

export interface ActiveInvite
  extends PortableInvitePayload {
  code: string;
  used: boolean;
  revoked: boolean;
  expiresAt: number;
}


/* ============================================================
   INVITE CODE CONFIGURATION
   ============================================================ */

/*
 * Excluded:
 *
 * 0 - can look like O
 * O - can look like 0
 * I - can look like 1
 * 1 - can look like I
 */
const CODE_CHARS =
  'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

const INVITE_CODE_LENGTH = 6;

const MAX_GENERATION_ATTEMPTS = 10;


/* ============================================================
   DATABASE TYPE
   ============================================================ */

type InviteRow = {
  code: string;

  family_id: string;

  baby_name: string | null;

  baby_dob: string | null;

  baby_gender: string | null;

  creator_id: string;

  creator_name: string | null;

  role:
    | 'parent2'
    | 'guardian'
    | 'viewer';

  relationship: string | null;

  created_at: number;

  expires_in_days: number;

  used: boolean;

  used_by: string | null;

  used_at: number | null;

  revoked: boolean;
};


/* ============================================================
   CRYPTOGRAPHIC RANDOM NUMBER
   ============================================================ */

function getSecureRandomNumber(
  max: number
): number {
  /*
   * Browser / modern JS environment
   */
  if (
    typeof crypto !== 'undefined' &&
    typeof crypto.getRandomValues === 'function'
  ) {
    const array = new Uint32Array(1);

    crypto.getRandomValues(array);

    /*
     * Avoid simple modulo bias by using
     * rejection sampling.
     */
    const maxUint32 = 0x100000000;

    const limit =
      maxUint32 -
      (maxUint32 % max);

    let randomValue: number;

    do {
      crypto.getRandomValues(array);

      randomValue = array[0];
    } while (randomValue >= limit);

    return randomValue % max;
  }

  /*
   * Fallback.
   *
   * This should normally not be reached in a
   * modern browser/Expo environment.
   */
  return Math.floor(
    Math.random() * max
  );
}


/* ============================================================
   GENERATE INVITE CODE
   ============================================================ */

/**
 * Generates a cryptographically stronger,
 * human-readable 6-character invite code.
 *
 * Examples:
 *
 *   K7M4PX
 *   AB29QF
 *   W8R3TZ
 */
export function generateInviteCode(
  _payload?: PortableInvitePayload
): string {
  let code = '';

  for (
    let i = 0;
    i < INVITE_CODE_LENGTH;
    i++
  ) {
    const index =
      getSecureRandomNumber(
        CODE_CHARS.length
      );

    code += CODE_CHARS[index];
  }

  return code;
}


/* ============================================================
   NORMALIZE CODE
   ============================================================ */

/**
 * Converts user input into the database format.
 *
 * Examples:
 *
 *   k7m4px   -> K7M4PX
 *   K7M-4PX  -> K7M4PX
 *   K7M 4PX  -> K7M4PX
 */
function normalizeInviteCode(
  code: string
): string {
  return code
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '');
}


/* ============================================================
   EXPIRATION
   ============================================================ */

function getInviteExpiration(
  createdAt: number,
  expiresInDays: number
): number {
  return (
    createdAt +
    expiresInDays *
      86_400_000
  );
}


/* ============================================================
   ROW -> PAYLOAD
   ============================================================ */

function rowToPayload(
  row: InviteRow
): PortableInvitePayload {
  return {
    familyId: row.family_id,

    babyName:
      row.baby_name || '',

    babyDob:
      row.baby_dob ||
      undefined,

    babyGender:
      row.baby_gender ||
      undefined,

    creatorId:
      row.creator_id,

    creatorName:
      row.creator_name ||
      '',

    role:
      row.role,

    relationship:
      row.relationship ||
      undefined,

    createdAt:
      row.created_at,

    expiresInDays:
      row.expires_in_days,
  };
}


/* ============================================================
   STORE INVITE
   ============================================================ */

export async function storeInviteCode(
  code: string,
  payload: PortableInvitePayload
): Promise<void> {
  const normalizedCode =
    normalizeInviteCode(code);

  if (
    normalizedCode.length !==
    INVITE_CODE_LENGTH
  ) {
    throw new Error(
      'Invite code must be exactly 6 characters'
    );
  }

  const { error } =
    await supabase
      .from('invite_codes')
      .insert({
        code: normalizedCode,

        family_id:
          payload.familyId,

        baby_name:
          payload.babyName,

        baby_dob:
          payload.babyDob ??
          null,

        baby_gender:
          payload.babyGender ??
          null,

        creator_id:
          payload.creatorId,

        creator_name:
          payload.creatorName,

        role:
          payload.role,

        relationship:
          payload.relationship ??
          null,

        created_at:
          payload.createdAt,

        expires_in_days:
          payload.expiresInDays,

        used: false,

        used_by: null,

        used_at: null,

        revoked: false,
      });

  if (error) {
    throw error;
  }
}


/* ============================================================
   CREATE + STORE UNIQUE INVITE
   ============================================================ */

/**
 * Generates a code and attempts to store it.
 *
 * If a collision occurs, a new code is generated.
 *
 * This is the function I recommend your UI use when
 * creating an invitation.
 */
export async function createInviteCode(
  payload: PortableInvitePayload
): Promise<string> {
  for (
    let attempt = 0;
    attempt < MAX_GENERATION_ATTEMPTS;
    attempt++
  ) {
    const code =
      generateInviteCode(payload);

    try {
      await storeInviteCode(
        code,
        payload
      );

      return code;
    } catch (error: any) {
      /*
       * PostgreSQL unique violation.
       *
       * 23505 = unique_violation
       *
       * If the generated code already exists,
       * simply generate another one.
       */
      if (
        error?.code === '23505'
      ) {
        continue;
      }

      throw error;
    }
  }

  throw new Error(
    'Could not generate a unique invite code. Please try again.'
  );
}


/* ============================================================
   VALIDATE INVITE
   ============================================================ */

export async function validateInviteCode(
  code: string
): Promise<
  | {
      valid: true;
      invite: PortableInvitePayload;
    }
  | {
      valid: false;
      message: string;
    }
> {
  const normalizedCode =
    normalizeInviteCode(code);

  if (
    normalizedCode.length !==
    INVITE_CODE_LENGTH
  ) {
    return {
      valid: false,
      message:
        'Code must be 6 characters',
    };
  }

  const { data, error } =
    await supabase
      .from('invite_codes')
      .select('*')
      .eq(
        'code',
        normalizedCode
      )
      .maybeSingle();

  if (error) {
    console.error(
      'Error validating invite code:',
      error
    );

    return {
      valid: false,
      message:
        'Could not reach the server — check your connection',
    };
  }

  if (!data) {
    return {
      valid: false,
      message:
        'Invalid invite code',
    };
  }

  const invite =
    data as InviteRow;

  if (invite.revoked) {
    return {
      valid: false,
      message:
        'Invite code has been revoked',
    };
  }

  if (invite.used) {
    return {
      valid: false,
      message:
        'Invite code has already been used',
    };
  }

  const expiresAt =
    getInviteExpiration(
      invite.created_at,
      invite.expires_in_days
    );

  if (
    Date.now() > expiresAt
  ) {
    return {
      valid: false,
      message:
        'Invite code has expired',
    };
  }

  return {
    valid: true,
    invite:
      rowToPayload(invite),
  };
}


/* ============================================================
   MARK INVITE USED
   ============================================================ */

export async function markInviteCodeUsed(
  code: string,
  usedBy?: string
): Promise<void> {
  const normalizedCode =
    normalizeInviteCode(code);

  /*
   * Important:
   * Only mark an invite as used if it is
   * currently unused and not revoked.
   */
  const { data, error } =
    await supabase
      .from('invite_codes')
      .update({
        used: true,

        used_by:
          usedBy ??
          null,

        used_at:
          Date.now(),
      })
      .eq(
        'code',
        normalizedCode
      )
      .eq(
        'used',
        false
      )
      .eq(
        'revoked',
        false
      )
      .select('code')
      .maybeSingle();

  if (error) {
    throw error;
  }

  if (!data) {
    throw new Error(
      'Invite code is invalid, expired, revoked, or already used.'
    );
  }
}


/* ============================================================
   GET ACTIVE INVITES
   ============================================================ */

export async function getActiveInvites(
  familyId?: string
): Promise<ActiveInvite[]> {
  let query =
    supabase
      .from('invite_codes')
      .select('*')
      .eq(
        'revoked',
        false
      )
      .eq(
        'used',
        false
      );

  if (familyId) {
    query =
      query.eq(
        'family_id',
        familyId
      );
  }

  const {
    data,
    error,
  } = await query;

  if (error) {
    console.error(
      'Error getting active invites:',
      error
    );

    return [];
  }

  if (!data) {
    return [];
  }

  const now =
    Date.now();

  return (
    data as InviteRow[]
  )
    .map((row) => {
      const expiresAt =
        getInviteExpiration(
          row.created_at,
          row.expires_in_days
        );

      return {
        code: row.code,

        ...rowToPayload(row),

        used:
          row.used,

        revoked:
          row.revoked,

        expiresAt,
      };
    })
    .filter(
      (invite) =>
        now <=
        invite.expiresAt
    );
}


/* ============================================================
   REVOKE INVITE
   ============================================================ */

export async function revokeInviteCode(
  code: string
): Promise<boolean> {
  const normalizedCode =
    normalizeInviteCode(code);

  const { error } =
    await supabase
      .from('invite_codes')
      .update({
        revoked: true,
      })
      .eq(
        'code',
        normalizedCode
      );

  if (error) {
    console.error(
      'Error revoking invite code:',
      error
    );

    return false;
  }

  return true;
}


/* ============================================================
   DELETE INVITE
   ============================================================ */

export async function deleteInviteCode(
  code: string
): Promise<boolean> {
  const normalizedCode =
    normalizeInviteCode(code);

  const { error } =
    await supabase
      .from('invite_codes')
      .delete()
      .eq(
        'code',
        normalizedCode
      );

  if (error) {
    console.error(
      'Error deleting invite code:',
      error
    );

    return false;
  }

  return true;
}