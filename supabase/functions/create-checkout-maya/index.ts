// @ts-nocheck
// Saved Backup: Maya Checkout Supabase Edge Function
// Can be re-enabled anytime by deploying or invoking this function.

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

const MAYA_PUBLIC_KEY = Deno.env.get('MAYA_PUBLIC_KEY') || '';
const MAYA_SECRET_KEY = Deno.env.get('MAYA_SECRET_KEY') || '';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req: Request) => {
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

    const mayaPayload = {
      totalAmount: {
        value: Number(amount),
        currency: 'PHP',
      },
      items: [
        {
          name: itemDesc || 'BINHI Event Booking 50% Deposit',
          quantity: 1,
          totalAmount: {
            value: Number(amount),
          },
        },
      ],
      requestReferenceNumber: referenceNumber || `BNH-${crypto.randomUUID()}`,
      buyer: {
        firstName: buyer?.firstName || 'Valued',
        lastName: buyer?.lastName || 'Customer',
        contact: {
          phone: buyer?.contact?.phone || '+63 9171234567',
          email: buyer?.contact?.email || 'customer@binhiconcept.ph',
        },
      },
      redirectUrl: redirectUrl || {
        success: `${req.headers.get('origin') || 'http://localhost:5173'}/?page=payment-success`,
        failure: `${req.headers.get('origin') || 'http://localhost:5173'}/?page=payment-failure`,
        cancel: `${req.headers.get('origin') || 'http://localhost:5173'}/?page=payment-cancel`,
      },
    };

    const keysToTry = [MAYA_PUBLIC_KEY, MAYA_SECRET_KEY];
    const endpointsToTry = [
      'https://pg-sandbox.paymaya.com/checkout/v1/checkouts',
      'https://pg.paymaya.com/checkout/v1/checkouts',
    ];

    let lastError = 'Failed to create Maya Checkout session';

    for (const endpoint of endpointsToTry) {
      for (const key of keysToTry) {
        try {
          const response = await fetch(endpoint, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Basic ${btoa(`${key}:`)}`,
            },
            body: JSON.stringify(mayaPayload),
          });

          const responseData = await response.json();
          if (response.ok && responseData.redirectUrl) {
            return new Response(
              JSON.stringify({
                checkoutId: responseData.checkoutId,
                redirectUrl: responseData.redirectUrl,
              }),
              { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
          }
          if (responseData.message || responseData.error) {
            lastError = responseData.message || responseData.error;
          }
        } catch (e: any) {
          lastError = e?.message || lastError;
        }
      }
    }

    return new Response(
      JSON.stringify({ error: lastError }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err: any) {
    return new Response(
      JSON.stringify({ error: err?.message || 'Internal Server Error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
