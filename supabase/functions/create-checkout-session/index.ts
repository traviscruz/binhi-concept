// @ts-nocheck
// Supabase Edge Function: create-checkout-session
// Calls PayMongo Create Checkout Session API (POST https://api.paymongo.com/v1/checkout_sessions)
// Reads PAYMONGO_SECRET_KEY from Deno environment secrets.

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const PAYMONGO_SECRET_KEY = Deno.env.get('PAYMONGO_SECRET_KEY');

    if (!PAYMONGO_SECRET_KEY) {
      return new Response(
        JSON.stringify({ error: 'PAYMONGO_SECRET_KEY is not set in Supabase secrets.' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const body = await req.json();

    // ── Action: Retrieve Checkout Session Details from PayMongo API ─────────────
    if (body?.action === 'retrieve_session') {
      const sessionId = body?.checkout_session_id;
      if (!sessionId) {
        return new Response(
          JSON.stringify({ error: 'checkout_session_id is required for retrieve_session action.' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const basicAuthToken = btoa(`${PAYMONGO_SECRET_KEY}:`);
      const getRes = await fetch(`https://api.paymongo.com/v1/checkout_sessions/${sessionId}`, {
        method: 'GET',
        headers: {
          Authorization: `Basic ${basicAuthToken}`,
        },
      });

      const getData = await getRes.json();
      const attr = getData?.data?.attributes;
      const payments = attr?.payments || [];
      let paymentMethodUsed = attr?.payment_method_used || '';

      if (!paymentMethodUsed && payments.length > 0) {
        paymentMethodUsed = payments[0]?.attributes?.source?.type || payments[0]?.attributes?.payment_method_type || '';
      }

      return new Response(
        JSON.stringify({
          checkout_session_id: sessionId,
          payment_method_used: paymentMethodUsed,
          payments: payments,
          status: attr?.status,
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ── Action: Create Checkout Session ───────────────────────────────────────
    const { amount, itemDesc, referenceNumber, buyer, redirectUrl } = body;

    if (!amount || amount <= 0) {
      return new Response(
        JSON.stringify({ error: 'Valid deposit amount is required.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Convert amount in PHP to centavos (1 PHP = 100 centavos)
    const amountInCentavos = Math.round(Number(amount) * 100);
    const origin = req.headers.get('origin') || 'http://localhost:5173';

    const paymongoPayload = {
      data: {
        attributes: {
          billing: {
            name: `${buyer?.firstName || 'Valued'} ${buyer?.lastName || 'Customer'}`.trim(),
            email: buyer?.email || 'customer@binhiconcept.ph',
            phone: buyer?.phone ? buyer.phone.replace(/^\+?63\s*/, '').replace(/\D/g, '') : undefined,
          },
          send_email_receipt: true,
          show_description: true,
          show_line_items: true,
          cancel_url: redirectUrl?.cancel || `${origin}/?page=payment-cancel`,
          success_url: redirectUrl?.success || `${origin}/?page=payment-success`,
          line_items: [
            {
              currency: 'PHP',
              amount: amountInCentavos,
              name: itemDesc || 'BINHI Event Booking 50% Deposit',
              quantity: 1,
            },
          ],
          payment_method_types: ['card', 'gcash', 'paymaya', 'qrph'],
          reference_number: referenceNumber || `BNH-${crypto.randomUUID()}`,
        },
      },
    };

    const basicAuthToken = btoa(`${PAYMONGO_SECRET_KEY}:`);

    const response = await fetch('https://api.paymongo.com/v1/checkout_sessions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Basic ${basicAuthToken}`,
      },
      body: JSON.stringify(paymongoPayload),
    });

    const responseData = await response.json();

    if (!response.ok || !responseData?.data?.attributes?.checkout_url) {
      console.error('PayMongo API Error:', responseData);
      const errorMsg =
        responseData?.errors?.[0]?.detail ||
        responseData?.message ||
        'Failed to create PayMongo Checkout session';
      return new Response(
        JSON.stringify({ error: errorMsg }),
        { status: response.status || 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({
        checkout_url: responseData.data.attributes.checkout_url,
        checkout_id: responseData.data.id,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err: any) {
    console.error('Edge Function Internal Error:', err);
    return new Response(
      JSON.stringify({ error: err?.message || 'Internal Server Error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
