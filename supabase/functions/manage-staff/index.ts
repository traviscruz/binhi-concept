// @ts-nocheck
declare const Deno: any;

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req: any) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { action, ...payload } = await req.json();

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL'),
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'),
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    if (action === 'invite') {
      const { email, firstName, lastName, phone, role, tempPassword } = payload;

      const { data: inviteData, error: inviteError } = await supabaseAdmin.auth.admin.inviteUserByEmail(email, {
        data: {
          first_name: firstName,
          last_name: lastName,
          role,
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

      const userId = inviteData.user?.id;

      if (userId) {
        await supabaseAdmin.auth.admin.updateUserById(userId, {
          password: tempPassword,
          email_confirm: true,
        });

        await supabaseAdmin.from('profiles').upsert({
          id: userId,
          email,
          role,
          first_name: firstName,
          last_name: lastName,
          phone: phone || null,
          requires_password_change: true,
          is_disabled: false,
          updated_at: new Date().toISOString(),
        });
      }

      return new Response(JSON.stringify({ success: true, userId }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (action === 'toggle-status') {
      const { userId, isDisabled } = payload;

      const { error: profileError } = await supabaseAdmin
        .from('profiles')
        .update({ is_disabled: isDisabled, updated_at: new Date().toISOString() })
        .eq('id', userId);

      if (profileError) {
        return new Response(JSON.stringify({ error: profileError.message }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      if (isDisabled) {
        // Revoke user sessions globally to log them out everywhere immediately
        await supabaseAdmin.auth.admin.signOut(userId, 'global');
      }

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (action === 'update-role') {
      const { userId, role } = payload;

      // 1. Update public.profiles table
      const { error: profileError } = await supabaseAdmin
        .from('profiles')
        .update({ role, updated_at: new Date().toISOString() })
        .eq('id', userId);

      if (profileError) {
        return new Response(JSON.stringify({ error: profileError.message }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // 2. Update auth.users metadata role
      await supabaseAdmin.auth.admin.updateUserById(userId, {
        user_metadata: { role },
      });

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (action === 'delete') {
      const { userId, email } = payload;
      let targetUserId = userId;

      if (!targetUserId && email) {
        const { data: usersData, error: listError } = await supabaseAdmin.auth.admin.listUsers();
        if (!listError && usersData?.users) {
          const found = usersData.users.find((u: any) => u.email?.toLowerCase() === email.trim().toLowerCase());
          if (found) {
            targetUserId = found.id;
          }
        }
      }

      if (targetUserId) {
        // Delete profiles record
        await supabaseAdmin.from('profiles').delete().eq('id', targetUserId);

        // Delete Auth user
        const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(targetUserId);

        if (deleteError) {
          return new Response(JSON.stringify({ error: deleteError.message }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
      } else if (email) {
        await supabaseAdmin.from('profiles').delete().eq('email', email.trim().toLowerCase());
      }

      return new Response(JSON.stringify({ success: true, deletedUserId: targetUserId }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ error: 'Unknown action' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err?.message || 'Internal server error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
