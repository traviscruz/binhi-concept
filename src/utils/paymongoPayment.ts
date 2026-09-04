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

export interface PaymongoCheckoutResult {
  checkout_url: string;
  checkout_id?: string;
}

/**
 * Creates a PayMongo Checkout Session supporting QR Ph, GCash, Maya, Cards, etc.
 * Features automated error recovery if certain payment methods (like QR Ph) are not yet enabled on the PayMongo merchant account.
 */
export async function createPaymongoCheckoutSession(
  params: PaymongoCheckoutParams
): Promise<PaymongoCheckoutResult> {
  // 1. Try invoking deployed Supabase Edge Function create-checkout-session
  try {
    const { data, error } = await supabase.functions.invoke('create-checkout-session', {
      body: params,
    });

    if (!error && data && data.checkout_url) {
      return {
        checkout_url: data.checkout_url,
        checkout_id: data.checkout_id,
      };
    }
  } catch (edgeErr) {
    console.warn('Supabase Edge Function create-checkout-session fallback:', edgeErr);
  }

  // 2. Direct Dev / Client-side fallback via PayMongo API
  const secretKey = (import.meta.env.VITE_PAYMONGO_SECRET_KEY || '').trim();
  const basicAuthToken = btoa(`${secretKey}:`);
  const amountInCentavos = Math.round(Number(params.amount) * 100);

  // Clean phone number: remove non-digits, ensure standard format
  const rawPhone = params.buyer.phone ? params.buyer.phone.replace(/\D/g, '') : '';
  const cleanPhone = rawPhone.length >= 10 ? rawPhone.slice(-10) : undefined;

  const buildPayload = (methods: string[]) => ({
    data: {
      attributes: {
        billing: {
          name: `${params.buyer.firstName || 'Valued'} ${params.buyer.lastName || 'Customer'}`.trim(),
          email: params.buyer.email || 'customer@binhiconcept.ph',
          phone: cleanPhone ? `0${cleanPhone}` : undefined,
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
            name: params.itemDesc || 'BINHI Event Production Reservation',
            quantity: 1,
          },
        ],
        payment_method_types: methods,
        reference_number: params.referenceNumber,
      },
    },
  });

  const endpoint = import.meta.env.DEV
    ? '/paymongo-api/v1/checkout_sessions'
    : 'https://api.paymongo.com/v1/checkout_sessions';

  // Try with qrph first. If PayMongo account hasn't enabled qrph, fallback tiers
  // will automatically retry without it — no manual account switch needed.
  const methodTiers = [
    ['card', 'gcash', 'paymaya', 'qrph', 'grab_pay'],
    ['card', 'gcash', 'paymaya', 'qrph'],
    ['card', 'gcash', 'paymaya'],
    ['card', 'gcash'],
  ];

  let lastErrorMsg = '';

  for (const methods of methodTiers) {
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Basic ${basicAuthToken}`,
        },
        body: JSON.stringify(buildPayload(methods)),
      });

      const responseText = await response.text();
      let responseData: any = null;
      try {
        responseData = responseText ? JSON.parse(responseText) : null;
      } catch { }

      if (response.ok && responseData?.data?.attributes?.checkout_url) {
        return {
          checkout_url: responseData.data.attributes.checkout_url,
          checkout_id: responseData.data.id,
        };
      }

      const errorDetail =
        responseData?.errors?.[0]?.detail ||
        responseData?.errors?.[0]?.description ||
        '';

      lastErrorMsg = errorDetail;

      // If the error is about a specific disallowed payment method (e.g. qrph not allowed), proceed to next tier
      const isPaymentMethodIssue =
        errorDetail.toLowerCase().includes('not allowed') ||
        errorDetail.toLowerCase().includes('payment_method') ||
        errorDetail.toLowerCase().includes('disabled') ||
        errorDetail.toLowerCase().includes('qrph') ||
        errorDetail.toLowerCase().includes('method');

      if (!isPaymentMethodIssue) {
        // If it's a completely different error (e.g. invalid auth), throw immediately
        throw new Error(errorDetail || 'Failed to initialize PayMongo checkout.');
      }

      console.warn(`PayMongo method tier [${methods.join(', ')}] was restricted (${errorDetail}), trying fallback tier...`);
    } catch (e: any) {
      if (!e.message?.includes('not allowed') && !e.message?.includes('payment_method') && lastErrorMsg) {
        throw e;
      }
    }
  }

  throw new Error(
    lastErrorMsg ||
    'Unable to create PayMongo Checkout session. Please check your PayMongo API key and payment method settings.'
  );
}

/**
 * Retrieves a checkout session status and resolves the paid payment method (QR Ph, GCash, Maya, Card, etc.).
 */
export async function retrievePaymongoCheckoutSession(sessionId: string): Promise<{
  status?: string;
  paymentMethodUsed?: string;
  payments?: any[];
} | null> {
  // 1. Try Supabase Edge Function
  try {
    const { data, error } = await supabase.functions.invoke('create-checkout-session', {
      body: {
        action: 'retrieve_session',
        checkout_session_id: sessionId,
      },
    });

    if (!error && data) {
      return {
        status: data.status,
        paymentMethodUsed: data.payment_method_used,
        payments: data.payments,
      };
    }
  } catch (e) {
    console.warn('Edge function session retrieve fallback:', e);
  }

  // 2. Direct API fallback
  try {
    const secretKey = (import.meta.env.VITE_PAYMONGO_SECRET_KEY || '').trim();
    if (!secretKey) return null;

    const basicAuthToken = btoa(`${secretKey}:`);
    const endpoint = import.meta.env.DEV
      ? `/paymongo-api/v1/checkout_sessions/${sessionId}`
      : `https://api.paymongo.com/v1/checkout_sessions/${sessionId}`;

    const res = await fetch(endpoint, {
      method: 'GET',
      headers: {
        Authorization: `Basic ${basicAuthToken}`,
      },
    });

    if (res.ok) {
      const data = await res.json();
      const attr = data?.data?.attributes;
      const payments = attr?.payments || [];
      let paymentMethodUsed = attr?.payment_method_used || '';

      if (!paymentMethodUsed && payments.length > 0) {
        paymentMethodUsed =
          payments[0]?.attributes?.source?.type ||
          payments[0]?.attributes?.payment_method_type ||
          payments[0]?.attributes?.source?.channel ||
          '';
      }

      return {
        status: attr?.status,
        paymentMethodUsed,
        payments,
      };
    }
  } catch (err) {
    console.warn('Direct PayMongo session retrieve error:', err);
  }

  return null;
}
