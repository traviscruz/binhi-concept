import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL'),
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'),
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    // 1. Fetch all users from auth.users via admin API
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.listUsers({
      page: 1,
      perPage: 1000,
    });

    if (authError) {
      return new Response(JSON.stringify({ error: authError.message }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 2. Fetch all profiles from public.profiles table
    const { data: profilesData, error: profilesError } = await supabaseAdmin
      .from('profiles')
      .select('*');

    if (profilesError) {
      return new Response(JSON.stringify({ error: profilesError.message }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const profilesMap = new Map(profilesData?.map((p) => [p.id, p]) || []);
    const staffList = [];

    for (const authUser of authData?.users || []) {
      const profile = profilesMap.get(authUser.id);
      const metadata = authUser.user_metadata || {};
      const role = profile?.role || metadata.role || 'customer';

      // Only include staff roles
      if (['admin', 'inventory_manager', 'crew'].includes(role)) {
        staffList.push({
          id: authUser.id,
          email: authUser.email,
          first_name: profile?.first_name || metadata.first_name || '',
          last_name: profile?.last_name || metadata.last_name || '',
          role: role,
          phone: profile?.phone || authUser.phone || 'N/A',
          is_disabled: profile?.is_disabled || false,
          requires_password_change: profile?.requires_password_change ?? metadata.requires_password_change ?? true,
          last_sign_in_at: authUser.last_sign_in_at || null,
          has_never_logged_in: !authUser.last_sign_in_at,
          created_at: authUser.created_at,
        });
      }
    }

    // Sort by created_at descending
    staffList.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    return new Response(JSON.stringify({ staff: staffList }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
