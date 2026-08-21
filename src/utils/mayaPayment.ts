import { supabase } from '../lib/supabase';

export interface MayaBuyerInfo {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
}

export interface MayaCheckoutParams {
  amount: number;
  itemDesc: string;
  referenceNumber: string;
  buyer: MayaBuyerInfo;
  redirectUrl: {
    success: string;
    failure: string;
    cancel: string;
  };
}

export async function createMayaCheckout(params: MayaCheckoutParams): Promise<{ redirectUrl: string; checkoutId?: string }> {
  // 1. Try invoking the Supabase Edge Function create-checkout
  try {
    const { data, error } = await supabase.functions.invoke('create-checkout', {
      body: params,
    });

    if (!error && data && data.redirectUrl) {
      return { redirectUrl: data.redirectUrl, checkoutId: data.checkoutId };
    }
  } catch (err) {
    console.warn('Supabase Edge Function invoke warning:', err);
  }

  // 2. Direct Maya Sandbox API execution with Public & Secret Key Fallback
  const publicKey = import.meta.env.VITE_MAYA_PUBLIC_KEY || 'pk-eo4sL393CWU5KmveJUaW8V730TTei2zY8zE4dHJDxkF';
  const secretKey = import.meta.env.VITE_MAYA_SECRET_KEY || 'sk-KfmfLJXFdV5t1inYN8lIOwSrueC1G27SCAklBqYCdrU';

  const mayaPayload = {
    totalAmount: {
      value: Number(params.amount),
      currency: 'PHP',
    },
    items: [
      {
        name: params.itemDesc,
        quantity: 1,
        totalAmount: {
          value: Number(params.amount),
        },
      },
    ],
    requestReferenceNumber: params.referenceNumber,
    buyer: {
      firstName: params.buyer.firstName || 'Valued',
      lastName: params.buyer.lastName || 'Customer',
      contact: {
        phone: params.buyer.phone || '+63 9171234567',
        email: params.buyer.email || 'customer@binhiconcept.ph',
      },
    },
    redirectUrl: params.redirectUrl,
  };

  const keysToTry = [publicKey, secretKey];
  const endpointsToTry = [
    'https://pg-sandbox.paymaya.com/checkout/v1/checkouts',
    'https://pg.paymaya.com/checkout/v1/checkouts',
  ];

  let lastErrorMsg = '';

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
          return {
            redirectUrl: responseData.redirectUrl,
            checkoutId: responseData.checkoutId,
          };
        }
        if (responseData.message || responseData.error) {
          lastErrorMsg = responseData.message || responseData.error;
        }
      } catch (err: any) {
        lastErrorMsg = err?.message || 'Network error';
      }
    }
  }

  throw new Error(lastErrorMsg || 'Invalid endpoint or Maya API credentials. Please verify Sandbox settings.');
}
