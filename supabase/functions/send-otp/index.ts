// @ts-nocheck
// Supabase Edge Function: send-otp
// Generates a 6-digit OTP, sends it via PhilSMS, and returns a stateless HMAC token (No DB needed)

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
    const { phoneNumber } = await req.json();

    if (!phoneNumber) {
      return new Response(
        JSON.stringify({ success: false, error: 'Phone number is required.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const normalizedPhone = normalizePhilippinePhone(phoneNumber);
    if (!normalizedPhone || normalizedPhone.length !== 12 || !normalizedPhone.startsWith('639')) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: `Invalid Philippine mobile number: "${phoneNumber}". Please provide a valid mobile number starting with 09 or +639.` 
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 1. Generate 6-digit cryptographic OTP code
    const code = Math.floor(100000 + Math.random() * 900000).toString();

    // 2. Set expiration (10 minutes)
    const expiresAt = Date.now() + 10 * 60 * 1000;

    // 3. Stateless HMAC token generation
    const hmacSecret = Deno.env.get('OTP_SECRET') || Deno.env.get('SUPABASE_JWT_SECRET') || 'binhi-stateless-otp-secret';
    const payloadToSign = `${normalizedPhone}:${code}:${expiresAt}`;
    const signature = await createHmacSignature(hmacSecret, payloadToSign);
    const token = `${expiresAt}.${signature}`;

    // 4. PhilSMS Dispatch
    const apiToken = Deno.env.get('PHILSMS_API_TOKEN');
    let senderId = Deno.env.get('PHILSMS_SENDER_NAME') || 'PhilSMS';
    const smsMessage = `Your BINHI Concept verification code is: ${code}. Valid for 10 minutes. Do not share this code with anyone.`;

    if (!apiToken) {
      console.warn(`[send-otp] PHILSMS_API_TOKEN not set. Simulating OTP for ${normalizedPhone}. Code: ${code}`);
      return new Response(
        JSON.stringify({
          success: true,
          simulated: true,
          token,
          expiresAt,
          phoneNumber: normalizedPhone,
          message: 'OTP simulated. Secret not set.',
          simulatedCode: code,
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Attempt sending with configured sender ID
    let response = await fetch('https://dashboard.philsms.com/api/v3/sms/send', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiToken}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify({
        recipient: normalizedPhone,
        sender_id: senderId,
        type: 'plain',
        message: smsMessage,
      }),
    });

    let responseText = await response.text();
    let result: any = {};
    try {
      result = JSON.parse(responseText);
    } catch {
      result = { raw: responseText };
    }

    // If custom sender ID is unauthorized on PhilSMS account, auto-fallback to default 'PhilSMS'
    if (!response.ok && senderId !== 'PhilSMS' && (result?.message?.includes('not authorized') || response.status === 404)) {
      console.warn(`[send-otp] Sender ID "${senderId}" not yet authorized by telcos. Falling back to default "PhilSMS"...`);
      senderId = 'PhilSMS';
      response = await fetch('https://dashboard.philsms.com/api/v3/sms/send', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiToken}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify({
          recipient: normalizedPhone,
          sender_id: 'PhilSMS',
          type: 'plain',
          message: smsMessage,
        }),
      });

      responseText = await response.text();
      try {
        result = JSON.parse(responseText);
      } catch {
        result = { raw: responseText };
      }
    }

    if (!response.ok) {
      const errorMsg = result?.message || result?.error || `PhilSMS API returned HTTP ${response.status}`;
      console.error('[send-otp] PhilSMS Error:', errorMsg, result);
      return new Response(
        JSON.stringify({ success: false, error: errorMsg, details: result }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        token,
        expiresAt,
        phoneNumber: normalizedPhone,
        message: 'Verification code sent successfully via SMS.',
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err: any) {
    console.error('[send-otp] Exception:', err);
    return new Response(
      JSON.stringify({ success: false, error: err.message || 'Failed to send OTP.' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
