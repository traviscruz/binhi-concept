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
    const { email, firstName, lastName, phone, role, tempPassword } = await req.json();

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL'),
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'),
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    // inviteUserByEmail => triggers 'Invite user' email template (not Confirm signup OTP)
    const { data: inviteData, error: inviteError } = await supabaseAdmin.auth.admin.inviteUserByEmail(email, {
      data: {
        first_name: firstName,
        last_name: lastName,
        role: role,
        temp_password: tempPassword,
        requires_password_change: true,
      },
    });

    if (inviteError) {
      return new Response(JSON.stringify({ error: inviteError.message }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const userId = inviteData.user && inviteData.user.id;

    if (userId) {
      // Set temp password + auto-confirm email so staff can login immediately without clicking invite link
      await supabaseAdmin.auth.admin.updateUserById(userId, {
        password: tempPassword,
        email_confirm: true,
      });

      // Upsert profile record
      await supabaseAdmin.from('profiles').upsert({
        id: userId,
        email: email,
        role: role,
        first_name: firstName,
        last_name: lastName,
        phone: phone,
        requires_password_change: true,
        is_disabled: false,
        updated_at: new Date().toISOString(),
      });
    }

    return new Response(JSON.stringify({ success: true, userId: userId }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
