import { supabase } from '../lib/supabase';

export interface PaymongoBuyerInfo {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
}

export interface PaymongoCheckoutParams {
  amount: number;
  itemDesc: string;
  referenceNumber: string;
  buyer: PaymongoBuyerInfo;
  redirectUrl: {
    success: string;
    failure: string;
    cancel: string;
  };
}

export async function createPaymongoCheckoutSession(params: PaymongoCheckoutParams): Promise<{ checkout_url: string }> {
  // 1. Try invoking deployed Supabase Edge Function create-checkout-session
  try {
    const { data, error } = await supabase.functions.invoke('create-checkout-session', {
      body: params,
    });

    if (!error && data && data.checkout_url) {
      return { checkout_url: data.checkout_url };
    }
  } catch (edgeErr) {
    console.warn('Supabase Edge Function not deployed on Cloud yet, attempting dev fallback:', edgeErr);
  }

  // 2. Dev Proxy Fallback (Guarantees testing works when Edge Function is not deployed to Cloud)
  const secretKey = (import.meta.env.VITE_PAYMONGO_SECRET_KEY || '').trim();
  const basicAuthToken = btoa(`${secretKey}:`);
  const amountInCentavos = Math.round(Number(params.amount) * 100);

  const paymongoPayload = {
    data: {
      attributes: {
        billing: {
          name: `${params.buyer.firstName || 'Valued'} ${params.buyer.lastName || 'Customer'}`.trim(),
          email: params.buyer.email || 'customer@binhiconcept.ph',
        },
        send_email_receipt: true,
        show_description: true,
        show_line_items: true,
        cancel_url: params.redirectUrl.cancel,
        success_url: params.redirectUrl.success,
        line_items: [
          {
            currency: 'PHP',
            amount: amountInCentavos,
            name: params.itemDesc || 'BINHI Event Booking 50% Deposit',
            quantity: 1,
          },
        ],
        payment_method_types: ['card', 'gcash', 'paymaya', 'qrph'],
        reference_number: params.referenceNumber,
      },
    },
  };

  const endpoint = import.meta.env.DEV
    ? '/paymongo-api/v1/checkout_sessions'
    : 'https://api.paymongo.com/v1/checkout_sessions';

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Basic ${basicAuthToken}`,
    },
    body: JSON.stringify(paymongoPayload),
  });

  const responseText = await response.text();
  if (responseText && responseText.trim()) {
    const responseData = JSON.parse(responseText);
    if (response.ok && responseData?.data?.attributes?.checkout_url) {
      return { checkout_url: responseData.data.attributes.checkout_url };
    }
    if (responseData?.errors?.[0]?.detail) {
      throw new Error(responseData.errors[0].detail);
    }
  }

  throw new Error('Unable to create PayMongo Checkout session. Please deploy your Edge Function or verify network settings.');
}
