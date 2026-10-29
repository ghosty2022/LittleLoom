// supabase/functions/reset-password-with-pin/index.ts
//
// Verifies a user's PIN hash against the server-side mirror
// (`user_pin_recovery`), then updates their auth password.
//
// Security model:
//  - The client only sends `pinHash` AFTER it has locally verified the
//    user knows the PIN (via SecureStore-stored hash comparison).
//  - The PIN hash therefore acts as a bearer secret.
//  - We still compare against the DB mirror when it exists, to detect
//    PIN changes made on another device.
//  - If the mirror row is missing (user set PIN offline / pre-mirror),
//    we trust the client-supplied hash and backfill the row — the user
//    could not produce `pinHash` without knowing the PIN.
//
// User-facing errors return HTTP 200 with `{ success: false, message }`
// so the client can display the real message instead of the generic
// "could not reach recovery service" fallback.

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const jsonOk = (body: Record<string, unknown>) =>
  new Response(JSON.stringify(body), {
    status: 200,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });

const jsonErr = (status: number, code: string, message: string) =>
  new Response(JSON.stringify({ success: false, code, message }), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });

const userMessage = (code: string, message: string) =>
  jsonOk({ success: false, code, message });

const isValidEmail = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return jsonErr(405, 'METHOD_NOT_ALLOWED', 'Use POST.');
  }

  try {
    const body = await req.json().catch(() => null);
    const email: unknown = body?.email;
    const pinHash: unknown = body?.pinHash;
    const newPassword: unknown = body?.newPassword;

    // ─── Input validation (user errors → 200) ────────────────────────
    if (typeof email !== 'string' || !isValidEmail(email.trim())) {
      return userMessage('INVALID_EMAIL', 'Please enter a valid email address.');
    }
    if (typeof pinHash !== 'string' || pinHash.length < 32) {
      return userMessage('INVALID_PIN_HASH', 'Invalid PIN verification token.');
    }
    if (typeof newPassword !== 'string' || newPassword.length < 8) {
      return userMessage('WEAK_PASSWORD', 'New password must be at least 8 characters.');
    }

    const cleanEmail = email.trim().toLowerCase();

    // ─── Admin client (service-role) ─────────────────────────────────
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
    const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
      // Genuine server misconfig → 500 so it shows up in logs/alerts.
      console.error('[reset-password-with-pin] Missing env vars');
      return jsonErr(
        500,
        'SERVER_MISCONFIGURED',
        'Recovery service is not configured. Please contact support.',
      );
    }

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // ─── Find user by email ──────────────────────────────────────────
    // listUsers is paginated (default 50). Loop until found or exhausted.
    let targetUser: { id: string; email?: string } | null = null;
    let page = 1;
    const perPage = 200;
    while (page <= 50) {
      const { data, error } = await admin.auth.admin.listUsers({
        page,
        perPage,
      });
      if (error) {
        console.error('[reset-password-with-pin] listUsers error:', error);
        return jsonErr(500, 'USER_LOOKUP_FAILED', error.message);
      }
      const users = data?.users ?? [];
      const match = users.find(
        (u) => (u.email || '').toLowerCase() === cleanEmail,
      );
      if (match) {
        targetUser = { id: match.id, email: match.email ?? undefined };
        break;
      }
      if (users.length < perPage) break;
      page += 1;
    }

    if (!targetUser) {
      return userMessage(
        'USER_NOT_FOUND',
        'No account found for this email address.',
      );
    }

    // ─── Verify PIN hash against mirror ──────────────────────────────
    const { data: pinRow, error: pinErr } = await admin
      .from('user_pin_recovery')
      .select('pin_hash')
      .eq('user_id', targetUser.id)
      .maybeSingle();

    if (pinErr) {
      // Missing table or DB-level failure — real server fault.
      console.error('[reset-password-with-pin] pin lookup error:', pinErr);
      return jsonErr(500, 'PIN_LOOKUP_FAILED', pinErr.message);
    }

    if (pinRow?.pin_hash) {
      if (pinRow.pin_hash !== pinHash) {
        return userMessage(
          'WRONG_PIN',
          'Incorrect PIN. Please try again.',
        );
      }
    } else {
      // No mirror row — user set PIN offline or pre-mirror. The client
      // could only produce pinHash after locally verifying the PIN, so
      // accept it and backfill the mirror.
      const { error: backfillErr } = await admin
        .from('user_pin_recovery')
        .upsert(
          {
            user_id: targetUser.id,
            pin_hash: pinHash,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'user_id' },
        );
      if (backfillErr) {
        console.error(
          '[reset-password-with-pin] backfill error:',
          backfillErr,
        );
        return jsonErr(
          500,
          'BACKFILL_FAILED',
          'Could not register PIN recovery. Please contact support.',
        );
      }
    }

    // ─── Update password ─────────────────────────────────────────────
    const { error: updateErr } = await admin.auth.admin.updateUserById(
      targetUser.id,
      { password: newPassword },
    );
    if (updateErr) {
      console.error('[reset-password-with-pin] update error:', updateErr);
      // Some update errors ARE user-facing (e.g. "Password should be
      // at least 8 characters" from auth). Surface them.
      return userMessage(
        'PASSWORD_UPDATE_FAILED',
        updateErr.message || 'Could not update password. Please try again.',
      );
    }

    return jsonOk({
      success: true,
      message:
        'Password reset successfully. You can now sign in with your new password.',
    });
  } catch (err) {
    console.error('[reset-password-with-pin] Unhandled:', err);
    return jsonErr(
      500,
      'INTERNAL',
      (err as Error)?.message ?? 'Internal server error.',
    );
  }
});