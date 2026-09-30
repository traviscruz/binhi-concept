import {
  getInquiryConfirmationHtml,
  getAdminInquiryAlertHtml,
  getAdminReplyHtml,
  getAdminRescheduleRequestAlertHtml,
  getCustomerRescheduleApprovedHtml,
  getCustomerRescheduleRejectedHtml,
  getAdminCancellationRequestAlertHtml,
  getCustomerCancellationRefundHtml,
  getCustomerCancellationRejectedHtml,
  getBookingConfirmationEmailHtml,
  getAdminNewBookingConfirmationAlertHtml,
  type InquiryEmailData,
  type InquiryReplyEmailData,
  type RescheduleRequestEmailData,
  type RescheduleApprovalEmailData,
  type RescheduleRejectionEmailData,
  type CancellationRequestEmailData,
  type CancellationRefundEmailData,
  type CancellationRejectionEmailData,
  type BookingConfirmationEmailData,
} from './emailTemplates';
import { supabase } from '../lib/supabase';

import { logSystemError } from './systemHealthService';

export interface SendEmailPayload {
  to: string;
  subject: string;
  html: string;
  text?: string;
  replyTo?: string;
}

export interface SendEmailResponse {
  success: boolean;
  messageId?: string;
  error?: string;
}

const getAdminEmail = () => import.meta.env.VITE_ADMIN_NOTIFICATION_EMAIL || 'admin@binhiconcept.ph';

/**
 * Sends an email via the Vite server email API endpoint.
 */
export async function sendEmail(payload: SendEmailPayload): Promise<SendEmailResponse> {
  try {
    const response = await fetch('/api/send-email', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    const data = await response.json();
    if (!response.ok || !data.success) {
      const errMsg = data.error || `HTTP ${response.status}: ${response.statusText}`;
      console.error('[emailService] Server returned error:', errMsg);
      
      // Automatically log to System Health Diagnostics for Admin troubleshooting
      try {
        logSystemError({
          service: 'email_sms',
          severity: 'medium',
          title: `Unsent Email: ${payload.subject.slice(0, 40)}...`,
          errorMessage: errMsg,
          endpointOrContext: `To: ${payload.to}`,
          payload,
        });
      } catch {}

      return { success: false, error: errMsg };
    }

    return { success: true, messageId: data.messageId };
  } catch (err: any) {
    const errMsg = err.message || 'Failed to communicate with email server';
    console.error('[emailService] Network/Fetch error:', err);

    // Automatically log to System Health Diagnostics for Admin troubleshooting
    try {
      logSystemError({
        service: 'email_sms',
        severity: 'medium',
        title: `Failed Dispatch: ${payload.subject.slice(0, 40)}...`,
        errorMessage: errMsg,
        endpointOrContext: `To: ${payload.to}`,
        payload,
      });
    } catch {}

    return { success: false, error: errMsg };
  }
}

/**
 * Sends both Customer Confirmation & Admin Alert emails upon new Contact Us submission.
 */
export async function sendInquiryEmails(inquiry: InquiryEmailData): Promise<{ customerSent: boolean; adminSent: boolean }> {
  let customerSent = false;
  let adminSent = false;
  const adminEmail = getAdminEmail();

  // 1. Send confirmation email to the customer
  try {
    const customerHtml = getInquiryConfirmationHtml(inquiry);
    const customerRes = await sendEmail({
      to: inquiry.email,
      subject: `We received your inquiry regarding ${inquiry.eventType} - BINHI Concept`,
      html: customerHtml,
      replyTo: adminEmail,
    });
    customerSent = customerRes.success;
  } catch (err) {
    console.error('[emailService] Error sending customer confirmation email:', err);
  }

  // 2. Send alert notification to the Admin
  try {
    const adminHtml = getAdminInquiryAlertHtml(inquiry);
    const adminRes = await sendEmail({
      to: adminEmail,
      subject: `[New Inquiry] ${inquiry.name} - ${inquiry.eventType}`,
      html: adminHtml,
      replyTo: inquiry.email,
    });
    adminSent = adminRes.success;
  } catch (err) {
    console.error('[emailService] Error sending admin alert email:', err);
  }

  return { customerSent, adminSent };
}

/**
 * Sends an Admin Reply email to the customer from the Admin Inquiry Inbox.
 */
export async function sendInquiryReplyEmail(
  replyData: InquiryReplyEmailData,
  recipientEmail: string
): Promise<SendEmailResponse> {
  const replyHtml = getAdminReplyHtml(replyData);
  const subject = replyData.originalInquiry?.eventType
    ? `Regarding your ${replyData.originalInquiry.eventType} inquiry - BINHI Concept`
    : 'Regarding your inquiry - BINHI Concept';

  return await sendEmail({
    to: recipientEmail,
    subject,
    html: replyHtml,
    replyTo: getAdminEmail(),
  });
}

/**
 * Sends an alert email to ALL system admins found in the database when a customer requests a reschedule.
 */
export async function sendAdminRescheduleAlert(
  data: RescheduleRequestEmailData
): Promise<{ success: boolean; sentCount: number; recipientCount: number }> {
  const defaultAdmin = getAdminEmail();
  const recipientEmails = new Set<string>();
  if (defaultAdmin) recipientEmails.add(defaultAdmin);

  // Fetch all registered admins from database
  try {
    const { data: adminProfiles } = await supabase
      .from('profiles')
      .select('email, role')
      .eq('role', 'admin');

    if (adminProfiles && adminProfiles.length > 0) {
      adminProfiles.forEach((p) => {
        if (p.email && p.email.includes('@')) {
          recipientEmails.add(p.email.trim());
        }
      });
    }
  } catch (err) {
    console.warn('[emailService] Could not query admin profiles from DB, using fallback admin email:', err);
  }

  const html = getAdminRescheduleRequestAlertHtml(data);
  const subject = `[Reschedule Request] ${data.customerName} - Ref #${data.bookingId} (${data.requestedDate})`;
  let sentCount = 0;

  for (const toEmail of recipientEmails) {
    try {
      const res = await sendEmail({
        to: toEmail,
        subject,
        html,
        replyTo: data.customerEmail,
      });
      if (res.success) sentCount++;
    } catch (e) {
      console.error(`[emailService] Failed to send reschedule alert to ${toEmail}:`, e);
    }
  }

  return {
    success: sentCount > 0,
    sentCount,
    recipientCount: recipientEmails.size,
  };
}

/**
 * Sends an email to the customer when their reschedule is approved or manually changed by admin.
 */
export async function sendCustomerRescheduleApproval(
  data: RescheduleApprovalEmailData
): Promise<SendEmailResponse> {
  const html = getCustomerRescheduleApprovedHtml(data);
  const subject = `Reschedule Confirmed: Your Event is Set for ${data.newDate} - BINHI Concept (#${data.bookingId})`;

  return await sendEmail({
    to: data.customerEmail,
    subject,
    html,
    replyTo: getAdminEmail(),
  });
}

/**
 * Sends an email to the customer when their reschedule request cannot be accommodated.
 */
export async function sendCustomerRescheduleRejection(
  data: RescheduleRejectionEmailData
): Promise<SendEmailResponse> {
  const html = getCustomerRescheduleRejectedHtml(data);
  const subject = `Regarding your Reschedule Request for #${data.bookingId} - BINHI Concept`;

  return await sendEmail({
    to: data.customerEmail,
    subject,
    html,
    replyTo: getAdminEmail(),
  });
}

/**
 * Sends an alert email to ALL system admins found in the database when a customer requests a booking cancellation & refund.
 */
export async function sendAdminCancellationAlert(
  data: CancellationRequestEmailData
): Promise<{ success: boolean; sentCount: number; recipientCount: number }> {
  const defaultAdmin = getAdminEmail();
  const recipientEmails = new Set<string>();
  if (defaultAdmin) recipientEmails.add(defaultAdmin);

  try {
    const { data: adminProfiles } = await supabase
      .from('profiles')
      .select('email, role')
      .eq('role', 'admin');

    if (adminProfiles && adminProfiles.length > 0) {
      adminProfiles.forEach((p) => {
        if (p.email && p.email.includes('@')) {
          recipientEmails.add(p.email.trim());
        }
      });
    }
  } catch (err) {
    console.warn('[emailService] Could not query admin profiles from DB, using fallback admin email:', err);
  }

  const html = getAdminCancellationRequestAlertHtml(data);
  const subject = `[Cancellation & Refund Request] ${data.customerName} - Ref #${data.bookingId} (${data.eventDate})`;
  let sentCount = 0;

  for (const toEmail of recipientEmails) {
    try {
      const res = await sendEmail({
        to: toEmail,
        subject,
        html,
        replyTo: data.customerEmail,
      });
      if (res.success) sentCount++;
    } catch (e) {
      console.error(`[emailService] Failed to send cancellation alert to ${toEmail}:`, e);
    }
  }

  return {
    success: sentCount > 0,
    sentCount,
    recipientCount: recipientEmails.size,
  };
}

/**
 * Sends an email to the customer when their booking is cancelled & refund is processed (PayMongo or Manual).
 */
export async function sendCustomerCancellationRefundEmail(
  data: CancellationRefundEmailData
): Promise<SendEmailResponse> {
  const html = getCustomerCancellationRefundHtml(data);
  const subject = `Booking Cancelled & Refund Processed - BINHI Concept (#${data.bookingId})`;

  return await sendEmail({
    to: data.customerEmail,
    subject,
    html,
    replyTo: getAdminEmail(),
  });
}

/**
 * Sends an email to the customer when their cancellation request is declined.
 */
export async function sendCustomerCancellationRejectionEmail(
  data: CancellationRejectionEmailData
): Promise<SendEmailResponse> {
  const html = getCustomerCancellationRejectedHtml(data);
  const subject = `Regarding your Cancellation Request for #${data.bookingId} - BINHI Concept`;

  return await sendEmail({
    to: data.customerEmail,
    subject,
    html,
    replyTo: getAdminEmail(),
  });
}

/**
 * Sends Official Booking Confirmation Email directly to the customer.
 */
export async function sendCustomerBookingConfirmationEmail(
  data: BookingConfirmationEmailData
): Promise<SendEmailResponse> {
  if (!data.customerEmail || !data.customerEmail.includes('@')) {
    return { success: false, error: 'Invalid or missing customer email address.' };
  }

  const html = getBookingConfirmationEmailHtml(data);
  const safeRef = data.paymongoReference || data.bookingId;
  const subject = `Official Booking Confirmation: #${safeRef} (${data.eventDate}) - BINHI Concept`;

  return await sendEmail({
    to: data.customerEmail.trim(),
    subject,
    html,
    replyTo: getAdminEmail(),
  });
}

/**
 * Sends both Customer Booking Confirmation & Admin New Booking Alert emails.
 */
export async function sendBookingConfirmationEmails(
  data: BookingConfirmationEmailData
): Promise<{ customerSent: boolean; adminSent: boolean }> {
  let customerSent = false;
  let adminSent = false;
  const adminEmail = getAdminEmail();

  // 1. Customer Confirmation Email
  try {
    const custRes = await sendCustomerBookingConfirmationEmail(data);
    customerSent = custRes.success;
  } catch (err) {
    console.error('[emailService] Error sending customer booking confirmation email:', err);
  }

  // 2. Admin Notification Alert
  try {
    if (adminEmail) {
      const adminHtml = getAdminNewBookingConfirmationAlertHtml(data);
      const safeRef = data.paymongoReference || data.bookingId;
      const adminRes = await sendEmail({
        to: adminEmail,
        subject: `[New Confirmed Booking] #${safeRef} - ${data.customerName} (${data.eventDate})`,
        html: adminHtml,
        replyTo: data.customerEmail,
      });
      adminSent = adminRes.success;
    }
  } catch (err) {
    console.error('[emailService] Error sending admin booking alert email:', err);
  }

  return { customerSent, adminSent };
}


