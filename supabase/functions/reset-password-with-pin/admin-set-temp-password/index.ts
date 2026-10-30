import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization') || '';
    const token = authHeader.replace('Bearer ', '');

    // Verify the caller is a signed-in Parent1/Parent2 for at least one
    // shared baby with the target user.
    const userClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });
    const { data: { user: caller }, error: userErr } =
      await userClient.auth.getUser();
    if (userErr || !caller) {
      return new Response(
        JSON.stringify({ message: 'Not authenticated' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const body = await req.json();
    const targetUserId = body.userId as string;
    const password = body.password as string;

    if (!targetUserId || !password || password.length < 8) {
      return new Response(
        JSON.stringify({ message: 'Missing userId or password' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

    // Authorisation: caller must share a baby where caller is
    // parent1/parent2 and target is also a member.
    const { data: sharedBabies, error: sharedErr } = await admin
      .from('family_members')
      .select('baby_id')
      .eq('user_id', caller.id)
      .in('role', ['parent1', 'parent2'])
      .is('deleted_at', null);

    if (sharedErr || !sharedBabies || sharedBabies.length === 0) {
      return new Response(
        JSON.stringify({ message: 'You do not have permission' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const babyIds = sharedBabies.map((r: any) => r.baby_id);
    const { data: targetMembership } = await admin
      .from('family_members')
      .select('id')
      .eq('user_id', targetUserId)
      .in('baby_id', babyIds)
      .is('deleted_at', null)
      .limit(1)
      .maybeSingle();

    if (!targetMembership) {
      return new Response(
        JSON.stringify({ message: 'Target user is not in your family' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // Set the password using the admin API.
    const { error: updateErr } = await admin.auth.admin.updateUserById(
      targetUserId,
      { password },
    );

    if (updateErr) {
      return new Response(
        JSON.stringify({ message: updateErr.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // Make sure the flag is set in case it wasn't already.
    await admin
      .from('profiles')
      .update({
        must_change_password: true,
        temp_password_set_at: new Date().toISOString(),
        temp_password_set_by: caller.id,
        updated_at: new Date().toISOString(),
      })
      .eq('id', targetUserId);

    // Invalidate all of the target's active sessions so they must
    // sign in with the new password.
    try {
      await admin.auth.admin.signOut(targetUserId, 'global');
    } catch {}

    return new Response(
      JSON.stringify({ success: true, message: 'Temporary password set' }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (e: any) {
    return new Response(
      JSON.stringify({ message: e?.message || 'Unexpected error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});