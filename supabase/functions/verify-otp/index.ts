// @ts-nocheck
// Supabase Edge Function: verify-otp
// Verifies the user's OTP code statelessly against the HMAC signed token (No DB needed)
// Also supports resetting user password via SMS verification

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// PhilSMS requires international country format: 639XXXXXXXXX (12 digits)
function normalizePhilippinePhone(phone: string): string {
  if (!phone) return '';
  let cleaned = phone.replace(/[^0-9+]/g, '');
  if (cleaned.startsWith('+63')) {
    cleaned = '63' + cleaned.substring(3);
  } else if (cleaned.startsWith('09')) {
    cleaned = '63' + cleaned.substring(1);
  } else if (cleaned.startsWith('9') && cleaned.length === 10) {
    cleaned = '63' + cleaned;
  }
  return cleaned;
}

async function createHmacSignature(secret: string, data: string): Promise<string> {
  const encoder = new TextEncoder();
  const keyData = encoder.encode(secret);
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    keyData,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const signature = await crypto.subtle.sign('HMAC', cryptoKey, encoder.encode(data));
  return Array.from(new Uint8Array(signature))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { phoneNumber, code, token, newPassword } = await req.json();

    if (!phoneNumber || !code || !token) {
      return new Response(
        JSON.stringify({ valid: false, error: 'Phone number, verification code, and token are required.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const normalizedPhone = normalizePhilippinePhone(phoneNumber);
    const trimmedCode = code.toString().trim();

    // Parse token: format is `${expiresAt}.${signatureHex}`
    const parts = token.split('.');
    if (parts.length !== 2) {
      return new Response(
        JSON.stringify({ valid: false, error: 'Invalid verification token format.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const [expiresAtStr, expectedSignature] = parts;
    const expiresAt = Number(expiresAtStr);

    if (isNaN(expiresAt) || Date.now() > expiresAt) {
      return new Response(
        JSON.stringify({ valid: false, error: 'Verification code has expired. Please request a new code.' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Recompute signature with the secret
    const hmacSecret = Deno.env.get('OTP_SECRET') || Deno.env.get('SUPABASE_JWT_SECRET') || 'binhi-stateless-otp-secret';
    const payloadToSign = `${normalizedPhone}:${trimmedCode}:${expiresAtStr}`;
    const computedSignature = await createHmacSignature(hmacSecret, payloadToSign);

    if (computedSignature !== expectedSignature) {
      return new Response(
        JSON.stringify({ valid: false, error: 'Incorrect verification code. Please check and try again.' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // If newPassword is provided, update the password via Supabase Admin Auth
    if (newPassword) {
      if (typeof newPassword !== 'string' || newPassword.length < 8) {
        return new Response(
          JSON.stringify({ valid: false, error: 'New password must be at least 8 characters long.' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const supabaseUrl = Deno.env.get('SUPABASE_URL');
      const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

      if (!supabaseUrl || !serviceRoleKey) {
        console.error('[verify-otp] Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in environment.');
        return new Response(
          JSON.stringify({ valid: false, error: 'Server configuration error. Service role key not found.' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
        auth: { autoRefreshToken: false, persistSession: false },
      });

      const phoneSuffix = normalizedPhone.slice(-10);
      const { data: profile, error: profErr } = await supabaseAdmin
        .from('profiles')
        .select('id, email, phone')
        .ilike('phone', `%${phoneSuffix}%`)
        .limit(1)
        .maybeSingle();

      if (profErr || !profile) {
        console.error('[verify-otp] Profile lookup failed for phone:', normalizedPhone, profErr);
        return new Response(
          JSON.stringify({ valid: false, error: 'No account profile matched this verified mobile number.' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const { error: updateErr } = await supabaseAdmin.auth.admin.updateUserById(profile.id, {
        password: newPassword,
      });

      if (updateErr) {
        console.error('[verify-otp] Password update error:', updateErr);
        return new Response(
          JSON.stringify({ valid: false, error: updateErr.message || 'Failed to update user password.' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      return new Response(
        JSON.stringify({
          valid: true,
          passwordUpdated: true,
          phoneNumber: normalizedPhone,
          message: 'Password has been successfully updated! You can now log in with your new password.',
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({
        valid: true,
        phoneNumber: normalizedPhone,
        message: 'Phone number verified successfully.',
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err: any) {
    console.error('[verify-otp] Exception:', err);
    return new Response(
      JSON.stringify({ valid: false, error: err.message || 'Verification process failed.' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
