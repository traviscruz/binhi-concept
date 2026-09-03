import {
  getInquiryConfirmationHtml,
  getAdminInquiryAlertHtml,
  getAdminReplyHtml,
  type InquiryEmailData,
  type InquiryReplyEmailData,
} from './emailTemplates';

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
      console.error('[emailService] Server returned error:', data.error || response.statusText);
      return { success: false, error: data.error || `HTTP ${response.status}: ${response.statusText}` };
    }

    return { success: true, messageId: data.messageId };
  } catch (err: any) {
    console.error('[emailService] Network/Fetch error:', err);
    return { success: false, error: err.message || 'Failed to communicate with email server' };
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
