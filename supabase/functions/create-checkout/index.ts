// Supabase Edge Function: create-checkout
// Handles PayMongo Checkout API integration (QR Ph, GCash, PayMaya, Cards, DOB)

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

const PAYMONGO_SECRET_KEY = Deno.env.get('PAYMONGO_SECRET_KEY') || '';
const PAYMONGO_CHECKOUT_URL = 'https://api.paymongo.com/v1/checkout_sessions';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { amount, itemDesc, referenceNumber, buyer, redirectUrl } = body;

    if (!amount || amount <= 0) {
      return new Response(
        JSON.stringify({ error: 'Valid deposit amount is required.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Convert amount in PHP to cents (PayMongo requires amount in cents)
    const amountInCents = Math.round(Number(amount) * 100);

    const paymongoPayload = {
      data: {
        attributes: {
          billing: {
            name: `${buyer?.firstName || 'Valued'} ${buyer?.lastName || 'Customer'}`,
            email: buyer?.email || 'customer@binhiconcept.ph',
            phone: buyer?.phone || '+639171234567',
          },
          send_email_receipt: true,
          show_description: true,
          show_line_items: true,
          cancel_url: redirectUrl?.cancel || `${req.headers.get('origin') || 'http://localhost:5173'}/?page=payment-cancel`,
          success_url: redirectUrl?.success || `${req.headers.get('origin') || 'http://localhost:5173'}/?page=payment-success`,
          line_items: [
            {
              currency: 'PHP',
              amount: amountInCents,
              name: itemDesc || 'BINHI Event Booking 50% Deposit',
              quantity: 1,
            },
          ],
          payment_method_types: ['qrph', 'gcash', 'paymaya', 'card', 'dob', 'grab_pay'],
          reference_number: referenceNumber || `BNH-${crypto.randomUUID()}`,
        },
      },
    };

    const basicAuthToken = btoa(`${PAYMONGO_SECRET_KEY}:`);

    const response = await fetch(PAYMONGO_CHECKOUT_URL, {
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
        checkoutId: responseData.data.id,
        redirectUrl: responseData.data.attributes.checkout_url,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err: any) {
    console.error('PayMongo Edge Function Error:', err);
    return new Response(
      JSON.stringify({ error: err?.message || 'Internal Server Error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
