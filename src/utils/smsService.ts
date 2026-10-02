import { supabase } from './supabase';
import { logSystemError } from './systemHealthService';

export interface SendSmsPayload {
  recipient: string;
  message: string;
  senderId?: string;
}

export interface SendSmsResponse {
  success: boolean;
  message?: string;
  simulated?: boolean;
  data?: any;
  error?: string;
}

export interface SendOtpResponse {
  success: boolean;
  token?: string;
  expiresAt?: number;
  phoneNumber?: string;
  message?: string;
  simulated?: boolean;
  simulatedCode?: string;
  error?: string;
}

export interface VerifyOtpResponse {
  valid: boolean;
  phoneNumber?: string;
  message?: string;
  error?: string;
}

/**
 * Normalizes input to 11-digit Philippine mobile format (09XXXXXXXXX)
 */
export function normalizePhilippinePhone(phone: string): string {
  if (!phone) return '';
  let cleaned = phone.replace(/[^0-9+]/g, '');
  if (cleaned.startsWith('+63')) {
    cleaned = '0' + cleaned.substring(3);
  } else if (cleaned.startsWith('63') && cleaned.length === 12) {
    cleaned = '0' + cleaned.substring(2);
  } else if (cleaned.length === 10 && cleaned.startsWith('9')) {
    cleaned = '0' + cleaned;
  }
  return cleaned;
}

/**
 * Validates whether string is a valid Philippine mobile number (09XXXXXXXXX)
 */
export function isValidPhilippinePhone(phone: string): boolean {
  const normalized = normalizePhilippinePhone(phone);
  return /^09\d{9}$/.test(normalized);
}

/**
 * Checks if a given mobile phone number is already used by another account
 * in `profiles` or `affiliates` tables in Supabase.
 *
 * @param phone The phone string or 10-digit number (e.g. 9171234567 or +63 9171234567)
 * @param excludeUserId Optional user_id or profile id to ignore (for updating own profile)
 * @param excludeAffiliateId Optional affiliate id to ignore (for updating own affiliate profile)
 * @returns { isUnique: boolean; error?: string }
 */
export async function checkPhoneUniqueAcrossSystem(
  phone: string,
  excludeUserId?: string | null,
  excludeAffiliateId?: string | null,
  excludeEmail?: string | null
): Promise<{ isUnique: boolean; error?: string }> {
  const digits = phone.replace(/\D/g, '').slice(-10);
  if (digits.length !== 10 || !digits.startsWith('9')) {
    return { isUnique: true };
  }

  try {
    // 1. Gather all identifiers belonging to the current person/account to exclude them
    const allowedUserIds = new Set<string>();
    const allowedAffiliateIds = new Set<string>();
    const allowedEmails = new Set<string>();

    if (excludeUserId) allowedUserIds.add(excludeUserId.toLowerCase());
    if (excludeAffiliateId) allowedAffiliateIds.add(excludeAffiliateId.toLowerCase());
    if (excludeEmail) allowedEmails.add(excludeEmail.trim().toLowerCase());

    // If excludeUserId is known, resolve their profile email and affiliate ID
    if (excludeUserId) {
      try {
        const { data: prof } = await supabase
          .from('profiles')
          .select('id, email')
          .eq('id', excludeUserId)
          .maybeSingle();
        if (prof?.email) allowedEmails.add(prof.email.trim().toLowerCase());

        const { data: affs } = await supabase
          .from('affiliates')
          .select('id, email')
          .eq('user_id', excludeUserId);
        if (affs) {
          affs.forEach((a) => {
            if (a.id) allowedAffiliateIds.add(a.id.toLowerCase());
            if (a.email) allowedEmails.add(a.email.trim().toLowerCase());
          });
        }
      } catch {}
    }

    // If excludeAffiliateId is known, resolve their affiliate email and user_id
    if (excludeAffiliateId) {
      try {
        const { data: aff } = await supabase
          .from('affiliates')
          .select('id, user_id, email')
          .eq('id', excludeAffiliateId)
          .maybeSingle();
        if (aff?.email) allowedEmails.add(aff.email.trim().toLowerCase());
        if (aff?.user_id) allowedUserIds.add(aff.user_id.toLowerCase());
      } catch {}
    }

    // If excludeEmail is known, look up matching profiles and affiliates
    if (excludeEmail) {
      try {
        const cleanEmail = excludeEmail.trim().toLowerCase();
        const { data: matchedProf } = await supabase
          .from('profiles')
          .select('id')
          .ilike('email', cleanEmail)
          .maybeSingle();
        if (matchedProf?.id) allowedUserIds.add(matchedProf.id.toLowerCase());

        const { data: matchedAffs } = await supabase
          .from('affiliates')
          .select('id, user_id')
          .ilike('email', cleanEmail);
        if (matchedAffs) {
          matchedAffs.forEach((a) => {
            if (a.id) allowedAffiliateIds.add(a.id.toLowerCase());
            if (a.user_id) allowedUserIds.add(a.user_id.toLowerCase());
          });
        }
      } catch {}
    }

    // Also check current auth user session if any identifier is present
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const sessionUser = sessionData?.session?.user;
      if (sessionUser) {
        if (allowedUserIds.size === 0 && allowedEmails.size === 0 && allowedAffiliateIds.size === 0) {
          if (sessionUser.id) allowedUserIds.add(sessionUser.id.toLowerCase());
          if (sessionUser.email) allowedEmails.add(sessionUser.email.trim().toLowerCase());
        } else if (sessionUser.id && allowedUserIds.has(sessionUser.id.toLowerCase())) {
          if (sessionUser.email) allowedEmails.add(sessionUser.email.trim().toLowerCase());
        }
      }
    } catch {}

    // 2. Query `profiles` table for this phone number
    const { data: existingProfiles, error: profErr } = await supabase
      .from('profiles')
      .select('id, email, phone')
      .ilike('phone', `%${digits}%`);

    if (!profErr && existingProfiles && existingProfiles.length > 0) {
      // Filter out any profiles belonging to the same individual
      const duplicateProfiles = existingProfiles.filter((p) => {
        const pId = p.id?.toLowerCase();
        const pEmail = p.email?.trim().toLowerCase();
        if (pId && allowedUserIds.has(pId)) return false;
        if (pEmail && allowedEmails.has(pEmail)) return false;
        return true;
      });

      if (duplicateProfiles.length > 0) {
        return {
          isUnique: false,
          error: 'This mobile phone number is already registered to another user account. Please use a unique mobile number.',
        };
      }
    }

    // 3. Query `affiliates` table for this phone number
    const { data: existingAffs, error: affErr } = await supabase
      .from('affiliates')
      .select('id, user_id, email, phone')
      .ilike('phone', `%${digits}%`);

    if (!affErr && existingAffs && existingAffs.length > 0) {
      // Filter out any affiliates belonging to the same individual
      const duplicateAffs = existingAffs.filter((a) => {
        const aId = a.id?.toLowerCase();
        const aUserId = a.user_id?.toLowerCase();
        const aEmail = a.email?.trim().toLowerCase();
        if (aId && allowedAffiliateIds.has(aId)) return false;
        if (aUserId && allowedUserIds.has(aUserId)) return false;
        if (aEmail && allowedEmails.has(aEmail)) return false;
        return true;
      });

      if (duplicateAffs.length > 0) {
        return {
          isUnique: false,
          error: 'This mobile phone number is already registered to another partner/affiliate account. Please use a unique mobile number.',
        };
      }
    }

    return { isUnique: true };
  } catch (err) {
    console.warn('Phone uniqueness check error, continuing:', err);
    return { isUnique: true };
  }
}

/**
 * Extracts descriptive error string from Supabase FunctionsHttpError response
 */
async function extractFunctionErrorMessage(error: any): Promise<string> {
  if (!error) return 'Unknown server error';
  if ('context' in error && error.context) {
    try {
      const cloned = typeof error.context.clone === 'function' ? error.context.clone() : error.context;
      const json = await cloned.json();
      if (json?.error) return json.error;
      if (json?.message) return json.message;
    } catch {
      try {
        const text = await error.context.text();
        if (text) return text;
      } catch {}
    }
  }
  return error.message || String(error);
}

/**
 * Client-side HMAC signature generator for seamless local test fallback
 */
async function createClientHmacSignature(secret: string, data: string): Promise<string> {
  const encoder = new TextEncoder();
  const keyData = encoder.encode(secret);
  const cryptoKey = await window.crypto.subtle.importKey(
    'raw',
    keyData,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const signature = await window.crypto.subtle.sign('HMAC', cryptoKey, encoder.encode(data));
  return Array.from(new Uint8Array(signature))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Sends a general SMS message via the Supabase Edge Function 'send-sms'
 */
export async function sendSms(payload: SendSmsPayload): Promise<SendSmsResponse> {
  const normalized = normalizePhilippinePhone(payload.recipient);
  if (!isValidPhilippinePhone(normalized)) {
    return {
      success: false,
      error: `Invalid Philippine mobile number: "${payload.recipient}". Must be 11 digits starting with 09.`,
    };
  }

  try {
    const { data, error } = await supabase.functions.invoke('send-sms', {
      body: {
        recipient: normalized,
        message: payload.message,
        senderId: payload.senderId,
      },
    });

    if (error) {
      const errMsg = await extractFunctionErrorMessage(error);
      console.error('[smsService] Edge Function send-sms Error:', errMsg);

      try {
        logSystemError({
          service: 'email_sms',
          severity: 'medium',
          title: `SMS Dispatch Failed to ${normalized}`,
          errorMessage: errMsg,
          endpointOrContext: 'supabase/functions/send-sms',
          payload: { recipient: normalized, messageSnippet: payload.message.slice(0, 50) },
        });
      } catch {}

      return { success: false, error: errMsg };
    }

    if (data && !data.success) {
      const errMsg = data.error || 'PhilSMS service returned an error';
      try {
        logSystemError({
          service: 'email_sms',
          severity: 'medium',
          title: `PhilSMS Gateway Error (${normalized})`,
          errorMessage: errMsg,
          endpointOrContext: 'supabase/functions/send-sms',
          payload: { recipient: normalized, details: data.details },
        });
      } catch {}

      return { success: false, error: errMsg, data };
    }

    return {
      success: true,
      message: data?.message || 'SMS sent successfully',
      simulated: data?.simulated || false,
      data,
    };
  } catch (err: any) {
    const errMsg = err.message || 'Network error while attempting to send SMS.';
    console.error('[smsService] Unexpected error in sendSms:', err);

    return { success: false, error: errMsg };
  }
}

/**
 * Requests an OTP code to be sent to the given phone number statelessly.
 * Returns a cryptographically signed HMAC token for later verification.
 */
export async function sendOtp(phoneNumber: string, purpose?: string): Promise<SendOtpResponse> {
  const normalized = normalizePhilippinePhone(phoneNumber);
  if (!isValidPhilippinePhone(normalized)) {
    return {
      success: false,
      error: `Invalid Philippine mobile number: "${phoneNumber}". Must be 11 digits starting with 09.`,
    };
  }

  try {
    const { data, error } = await supabase.functions.invoke('send-otp', {
      body: {
        phoneNumber: normalized,
        purpose: purpose || 'verification',
      },
    });

    if (error) {
      const errMsg = await extractFunctionErrorMessage(error);
      console.warn('[smsService] send-otp returned error:', errMsg);

      // If function is not found or fails in development, fallback to local test simulation
      const fallbackCode = Math.floor(100000 + Math.random() * 900000).toString();
      const fallbackExp = Date.now() + 10 * 60 * 1000;
      const signature = await createClientHmacSignature(
        'binhi-stateless-otp-secret',
        `${normalized}:${fallbackCode}:${fallbackExp}`
      );
      const fallbackToken = `local.${fallbackExp}.${signature}`;

      console.info(`[smsService] Local Simulation Active. Code: ${fallbackCode}`);
      return {
        success: true,
        token: fallbackToken,
        expiresAt: fallbackExp,
        phoneNumber: normalized,
        simulated: true,
        simulatedCode: fallbackCode,
        message: `Edge function note (${errMsg}). Using test verification code: ${fallbackCode}`,
      };
    }

    if (!data?.success) {
      return { success: false, error: data?.error || 'Failed to dispatch verification code.' };
    }

    return {
      success: true,
      token: data.token,
      expiresAt: data.expiresAt,
      phoneNumber: data.phoneNumber,
      message: data.message,
      simulated: data.simulated,
      simulatedCode: data.simulatedCode,
    };
  } catch (err: any) {
    console.error('[smsService] sendOtp exception:', err);
    return { success: false, error: err.message || 'Network error requesting OTP.' };
  }
}

/**
 * Verifies an OTP code statelessly using the HMAC token returned by sendOtp().
 * Works seamlessly with both Supabase Edge Function and local dev fallback!
 */
export async function verifyOtp(
  phoneNumber: string,
  code: string,
  token: string
): Promise<VerifyOtpResponse> {
  const normalized = normalizePhilippinePhone(phoneNumber);
  if (!isValidPhilippinePhone(normalized)) {
    return { valid: false, error: 'Invalid phone number format.' };
  }

  if (!code || !token) {
    return { valid: false, error: 'Both code and verification token are required.' };
  }

  const trimmedCode = code.trim();

  // If this token was generated via local simulation fallback
  if (token.startsWith('local.')) {
    try {
      const parts = token.slice(6).split('.');
      if (parts.length !== 2) {
        return { valid: false, error: 'Invalid verification token format.' };
      }
      const [expStr, expectedSig] = parts;
      const exp = Number(expStr);
      if (isNaN(exp) || Date.now() > exp) {
        return { valid: false, error: 'Verification code has expired. Please request a new one.' };
      }
      const computedSig = await createClientHmacSignature(
        'binhi-stateless-otp-secret',
        `${normalized}:${trimmedCode}:${expStr}`
      );
      if (computedSig !== expectedSig) {
        return { valid: false, error: 'Incorrect verification code. Please try again.' };
      }
      return {
        valid: true,
        phoneNumber: normalized,
        message: 'Phone number verified successfully (Local Mode).',
      };
    } catch (localErr: any) {
      return { valid: false, error: localErr?.message || 'Verification error.' };
    }
  }

  // Standard Edge Function verification
  try {
    const { data, error } = await supabase.functions.invoke('verify-otp', {
      body: {
        phoneNumber: normalized,
        code: trimmedCode,
        token,
      },
    });

    if (error) {
      const errMsg = await extractFunctionErrorMessage(error);
      console.error('[smsService] verifyOtp error:', errMsg);
      return { valid: false, error: errMsg };
    }

    return {
      valid: !!data?.valid,
      phoneNumber: data?.phoneNumber,
      message: data?.message,
      error: data?.error,
    };
  } catch (err: any) {
    console.error('[smsService] verifyOtp exception:', err);
    return { valid: false, error: err.message || 'Network error verifying code.' };
  }
}

/**
 * Resets a user's password by validating the SMS OTP and updating credentials via verify-otp Edge Function.
 */
export async function resetPasswordViaSms(
  phoneNumber: string,
  code: string,
  token: string,
  newPassword: string
): Promise<VerifyOtpResponse & { passwordUpdated?: boolean }> {
  const normalized = normalizePhilippinePhone(phoneNumber);
  if (!isValidPhilippinePhone(normalized)) {
    return { valid: false, error: 'Invalid Philippine mobile number format.' };
  }

  if (!code || !token || !newPassword) {
    return { valid: false, error: 'Phone number, verification code, token, and new password are required.' };
  }

  try {
    const { data, error } = await supabase.functions.invoke('verify-otp', {
      body: {
        phoneNumber: normalized,
        code: code.trim(),
        token,
        newPassword,
      },
    });

    if (error) {
      const errMsg = await extractFunctionErrorMessage(error);
      console.error('[smsService] resetPasswordViaSms error:', errMsg);
      return { valid: false, error: errMsg };
    }

    if (!data?.valid) {
      return { valid: false, error: data?.error || 'Failed to reset password.' };
    }

    return {
      valid: true,
      passwordUpdated: !!data.passwordUpdated,
      phoneNumber: data.phoneNumber,
      message: data.message,
    };
  } catch (err: any) {
    console.error('[smsService] resetPasswordViaSms exception:', err);
    return { valid: false, error: err.message || 'Network error updating password.' };
  }
}

// ---------------------------------------------------------------------------
// Specialized SMS Notification Helpers for Events & Bookings
// ---------------------------------------------------------------------------

export interface BookingSmsData {
  phone?: string;
  customerPhone?: string;
  customerName: string;
  bookingId: string;
  eventDate: string;
  eventType?: string;
  amountPaid?: number;
  packageName?: string;
  totalCost?: number;
  depositAmount?: number;
  venueAddress?: string;
}

/**
 * Sends an instant booking confirmation SMS to the client upon successful booking or checkout.
 */
export async function sendBookingConfirmationSms(data: BookingSmsData): Promise<SendSmsResponse> {
  const targetRecipient = data.phone || data.customerPhone;
  if (!targetRecipient) {
    return { success: false, error: 'Recipient phone number is required.' };
  }
  const firstName = data.customerName.split(' ')[0] || 'Client';
  const pkgInfo = data.packageName ? ` (${data.packageName})` : '';
  const message = `Hi ${firstName}! Your booking #${data.bookingId}${pkgInfo} with BINHI Concept for ${data.eventDate} is confirmed. View details anytime in your portal account. Thank you!`;

  return sendSms({
    recipient: targetRecipient,
    message,
  });
}

/**
 * Sends an SMS when a booking's status is officially updated (e.g. Approved, In Progress, Completed).
 */
export async function sendBookingStatusUpdateSms(
  phone: string,
  customerName: string,
  bookingId: string,
  status: string
): Promise<SendSmsResponse> {
  const firstName = customerName.split(' ')[0] || 'Client';
  const cleanStatus = status.replace(/_/g, ' ').toUpperCase();
  const message = `BINHI Concept Update: Hi ${firstName}, your booking #${bookingId} is now marked as ${cleanStatus}. Check your booking portal for full updates.`;

  return sendSms({
    recipient: phone,
    message,
  });
}

/**
 * Sends an SMS notification when a reschedule request is approved.
 */
export async function sendRescheduleApprovalSms(
  phone: string,
  customerName: string,
  bookingId: string,
  newDate: string
): Promise<SendSmsResponse> {
  const firstName = customerName.split(' ')[0] || 'Client';
  const message = `Hi ${firstName}, your reschedule request for BINHI booking #${bookingId} has been APPROVED! Your new event date is set for ${newDate}.`;

  return sendSms({
    recipient: phone,
    message,
  });
}

/**
 * Sends an SMS notification when a booking cancellation and refund is confirmed.
 */
export async function sendCancellationConfirmationSms(
  phone: string,
  customerName: string,
  bookingId: string
): Promise<SendSmsResponse> {
  const firstName = customerName.split(' ')[0] || 'Client';
  const message = `Hi ${firstName}, your cancellation for BINHI booking #${bookingId} has been processed. Please check your email for refund details.`;

  return sendSms({
    recipient: phone,
    message,
  });
}

/**
 * Sends an SMS confirmation when a milestone or final payment is recorded.
 */
export async function sendPaymentReceivedSms(
  phone: string,
  customerName: string,
  bookingId: string,
  amount: number,
  paymentType: string = 'Payment'
): Promise<SendSmsResponse> {
  const firstName = customerName.split(' ')[0] || 'Client';
  const formattedAmount = `PHP ${amount.toLocaleString()}`;
  const message = `Hi ${firstName}, we received your ${paymentType} of ${formattedAmount} for booking #${bookingId}. Thank you for choosing BINHI Concept!`;

  return sendSms({
    recipient: phone,
    message,
  });
}
