// @ts-nocheck
// Supabase Edge Function: send-sms
// Dispatches SMS notifications via PhilSMS API v3

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

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { recipient, message, senderId } = await req.json();

    if (!recipient || !message) {
      return new Response(
        JSON.stringify({ success: false, error: 'Recipient phone number and message are required.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const normalizedRecipient = normalizePhilippinePhone(recipient);
    if (!normalizedRecipient || normalizedRecipient.length !== 12 || !normalizedRecipient.startsWith('639')) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: `Invalid Philippine mobile number: "${recipient}". Expected format: 09XXXXXXXXX or +639XXXXXXXXX.` 
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const apiToken = Deno.env.get('PHILSMS_API_TOKEN');
    let configuredSender = senderId || Deno.env.get('PHILSMS_SENDER_NAME') || 'PhilSMS';

    if (!apiToken) {
      console.warn('[send-sms] PHILSMS_API_TOKEN not found in environment secrets. Simulating SMS dispatch.');
      return new Response(
        JSON.stringify({
          success: true,
          simulated: true,
          message: 'SMS simulated (PHILSMS_API_TOKEN secret not set in Supabase).',
          recipient: normalizedRecipient,
          content: message,
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // PhilSMS API v3 endpoint
    let response = await fetch('https://dashboard.philsms.com/api/v3/sms/send', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiToken}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify({
        recipient: normalizedRecipient,
        sender_id: configuredSender,
        type: 'plain',
        message: message,
      }),
    });

    let responseText = await response.text();
    let result: any = {};
    try {
      result = JSON.parse(responseText);
    } catch {
      result = { raw: responseText };
    }

    // If custom sender ID is unauthorized, fallback to default 'PhilSMS'
    if (!response.ok && configuredSender !== 'PhilSMS' && (result?.message?.includes('not authorized') || response.status === 404)) {
      console.warn(`[send-sms] Sender ID "${configuredSender}" not yet authorized. Falling back to "PhilSMS"...`);
      configuredSender = 'PhilSMS';
      response = await fetch('https://dashboard.philsms.com/api/v3/sms/send', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiToken}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify({
          recipient: normalizedRecipient,
          sender_id: 'PhilSMS',
          type: 'plain',
          message: message,
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
      console.error('[send-sms] PhilSMS Error:', errorMsg, result);
      return new Response(
        JSON.stringify({ success: false, error: errorMsg, details: result }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ success: true, data: result, recipient: normalizedRecipient }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err: any) {
    console.error('[send-sms] Exception:', err);
    return new Response(
      JSON.stringify({ success: false, error: err.message || 'Internal server error occurred while sending SMS.' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
