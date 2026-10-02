/**
 * BINHI Concept Branded Email Templates
 * Styled to match the official BINHI Concept letterhead and design language.
 */


export function getAppBaseUrl(): string {
  if (typeof import.meta !== 'undefined' && import.meta.env?.VITE_APP_URL) {
    return import.meta.env.VITE_APP_URL.replace(/\/+$/, '');
  }
  if (typeof process !== 'undefined' && process.env?.VITE_APP_URL) {
    return process.env.VITE_APP_URL.replace(/\/+$/, '');
  }
  if (typeof window !== 'undefined' && window.location?.origin && !window.location.origin.includes('localhost')) {
    return window.location.origin.replace(/\/+$/, '');
  }
  return 'https://binhiconcept.vercel.app';
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export interface InquiryEmailData {
  name: string;
  email: string;
  eventType: string;
  eventDate?: string;
  budget?: string;
  message: string;
  website?: string;
}

export interface InquiryReplyEmailData {
  recipientName: string;
  replyMessage: string;
  originalInquiry?: {
    eventType?: string;
    eventDate?: string;
    message?: string;
  };
}

/**
 * Common Base Email Frame
 */
function renderEmailShell({
  title,
  badgeText,
  headline,
  bodyContent,
}: {
  title: string;
  badgeText: string;
  headline: string;
  bodyContent: string;
}): string {
  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta name="color-scheme" content="light dark">
<meta name="supported-color-schemes" content="light dark">
<title>${escapeHtml(title)}</title>
<style>
  body, .bg-wrap { background-color:#F7F7F7; }
  .card { background-color:#FFFFFF; }
  .card, .divider { border-color:#E4E6EA; }
  .text-ink { color:#24252C; }
  .text-muted { color:#6B7280; }
  .text-muted-2 { color:#9AA1AC; }
  .code-box { background-color:#ECEEF1; border-color:#E4E6EA; }
  .code-text { color:#24252C; }
  .item-label { color:#9AA1AC; font-size:10px; font-weight:700; letter-spacing:1px; text-transform:uppercase; margin-bottom:2px; }
  .item-val { color:#24252C; font-size:13px; font-weight:600; }

  @media (prefers-color-scheme: dark) {
    body, .bg-wrap { background-color:#151619 !important; }
    .card { background-color:#1E2025 !important; }
    .card, .divider { border-color:#3A3C44 !important; }
    .text-ink { color:#F2F2F4 !important; }
    .text-muted { color:#B7B9C2 !important; }
    .text-muted-2 { color:#8A8D97 !important; }
    .code-box { background-color:#26282E !important; border-color:#3A3C44 !important; }
    .code-text { color:#F2F2F4 !important; }
    .item-label { color:#8A8D97 !important; }
    .item-val { color:#F2F2F4 !important; }
  }
</style>
</head>
<body class="bg-wrap" style="margin:0; padding:0; background-color:#F7F7F7; font-family:Arial,Helvetica,sans-serif; color:#24252C;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" class="bg-wrap" bgcolor="#F7F7F7" style="background-color:#F7F7F7;">
    <tr>
      <td align="center" style="padding:40px 16px;">

        <table role="presentation" width="100%" class="card" bgcolor="#FFFFFF" style="max-width:540px; background-color:#FFFFFF; border:1px solid #E4E6EA; border-radius:12px; overflow:hidden;">

          <!-- Letterhead -->
          <tr>
            <td style="padding:28px 36px; background-color:#24252C;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="left" style="vertical-align:middle; color:#FFFFFF; font-size:16px; font-weight:700; letter-spacing:0.3px; font-family:Arial,Helvetica,sans-serif;">
                    BINHI Concept
                  </td>
                  <td align="right" style="vertical-align:middle; font-size:10px; font-weight:700; letter-spacing:1.5px; color:#9AA1AC; font-family:Arial,Helvetica,sans-serif; text-transform:uppercase;">
                    ${escapeHtml(badgeText)}
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Body Content -->
          <tr>
            <td class="card" bgcolor="#FFFFFF" style="padding:36px 36px 12px 36px; background-color:#FFFFFF; text-align:left;">
              <h1 class="text-ink" style="margin:0 0 16px 0; font-size:20px; font-weight:700; color:#24252C; font-family:Arial,Helvetica,sans-serif; line-height:1.3;">
                ${escapeHtml(headline)}
              </h1>

              ${bodyContent}
            </td>
          </tr>

          <!-- Divider -->
          <tr>
            <td class="card" bgcolor="#FFFFFF" style="padding:0 36px; background-color:#FFFFFF;">
              <div class="divider" style="border-top:1px solid #E4E6EA; margin-top:20px;"></div>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td class="card" bgcolor="#FFFFFF" style="padding:20px 36px 28px 36px; background-color:#FFFFFF;">
              <p class="text-muted-2" style="margin:0 0 6px 0; font-size:11.5px; color:#9AA1AC; line-height:1.6; font-family:Arial,Helvetica,sans-serif;">
                This is an automated notification from BINHI Concept Pro Audio &amp; Event Solutions.
              </p>
              <p class="text-muted-2" style="margin:0; font-size:11.5px; color:#9AA1AC; font-family:Arial,Helvetica,sans-serif;">
                Help Center &nbsp;·&nbsp; Privacy Policy &nbsp;·&nbsp; &copy; BINHI Concept. All rights reserved.
              </p>
            </td>
          </tr>

        </table>

      </td>
    </tr>
  </table>
</body>
</html>`;
}

/**
 * 1. Template: Customer Inquiry Confirmation Email
 * Sent to the customer after submitting the Contact Us form.
 */
export function getInquiryConfirmationHtml(data: InquiryEmailData): string {
  const safeName = escapeHtml(data.name);
  const safeEventType = escapeHtml(data.eventType);
  const safeDate = data.eventDate ? escapeHtml(data.eventDate) : 'Not specified';
  const safeBudget = data.budget ? escapeHtml(data.budget) : 'Flexible / To be discussed';
  const safeWebsite = data.website ? escapeHtml(data.website) : '';
  const safeMessage = escapeHtml(data.message).replace(/\n/g, '<br/>');

  const bodyContent = `
    <p class="text-muted" style="margin:0 0 24px 0; font-size:14px; color:#6B7280; line-height:1.65; font-family:Arial,Helvetica,sans-serif;">
      Hi <strong class="text-ink" style="color:#24252C;">${safeName}</strong>, thank you for reaching out to <strong>BINHI Concept</strong>! We have received your event inquiry and our team is already reviewing your requirements.
    </p>

    <p class="text-muted-2" style="margin:0 0 8px 0; font-size:11px; font-weight:700; letter-spacing:1.5px; color:#9AA1AC; font-family:Arial,Helvetica,sans-serif;">INQUIRY SUMMARY</p>
    
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" class="code-box" bgcolor="#ECEEF1" style="background-color:#ECEEF1; border:1px solid #E4E6EA; border-radius:8px; margin-bottom:24px;">
      <tr>
        <td style="padding:16px 20px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
            <tr>
              <td style="padding-bottom:12px; width:50%; vertical-align:top;">
                <div class="item-label" style="color:#9AA1AC; font-size:10px; font-weight:700; letter-spacing:1px; text-transform:uppercase; margin-bottom:2px;">Event Type</div>
                <div class="item-val" style="color:#24252C; font-size:13px; font-weight:600;">${safeEventType}</div>
              </td>
              <td style="padding-bottom:12px; width:50%; vertical-align:top;">
                <div class="item-label" style="color:#9AA1AC; font-size:10px; font-weight:700; letter-spacing:1px; text-transform:uppercase; margin-bottom:2px;">Target Date</div>
                <div class="item-val" style="color:#24252C; font-size:13px; font-weight:600;">${safeDate}</div>
              </td>
            </tr>
            <tr>
              <td style="padding-bottom:12px; vertical-align:top;">
                <div class="item-label" style="color:#9AA1AC; font-size:10px; font-weight:700; letter-spacing:1px; text-transform:uppercase; margin-bottom:2px;">Est. Budget</div>
                <div class="item-val" style="color:#24252C; font-size:13px; font-weight:600;">${safeBudget}</div>
              </td>
              <td style="padding-bottom:12px; vertical-align:top;">
                <div class="item-label" style="color:#9AA1AC; font-size:10px; font-weight:700; letter-spacing:1px; text-transform:uppercase; margin-bottom:2px;">Contact Email</div>
                <div class="item-val" style="color:#24252C; font-size:13px; font-weight:600;">${escapeHtml(data.email)}</div>
              </td>
            </tr>
            ${
              safeWebsite
                ? `
            <tr>
              <td colspan="2" style="padding-bottom:12px; vertical-align:top;">
                <div class="item-label" style="color:#9AA1AC; font-size:10px; font-weight:700; letter-spacing:1px; text-transform:uppercase; margin-bottom:2px;">Website / Social</div>
                <div class="item-val" style="color:#1090F8; font-size:13px; font-weight:600;"><a href="${safeWebsite}" style="color:#1090F8; text-decoration:none;">${safeWebsite}</a></div>
              </td>
            </tr>`
                : ''
            }
            <tr>
              <td colspan="2" style="padding-top:4px; vertical-align:top; border-top:1px dashed #D5D8DF;">
                <div class="item-label" style="color:#9AA1AC; font-size:10px; font-weight:700; letter-spacing:1px; text-transform:uppercase; margin-top:8px; margin-bottom:4px;">Your Message</div>
                <div style="color:#24252C; font-size:13px; line-height:1.6; font-style:italic; font-family:Arial,Helvetica,sans-serif;">"${safeMessage}"</div>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>

    <p class="text-muted" style="margin:0 0 16px 0; font-size:13px; color:#6B7280; line-height:1.65; font-family:Arial,Helvetica,sans-serif;">
      Our production specialists typically respond within <strong>24 hours</strong> with tailored package options, technical inclusions, and availability.
    </p>
  `;

  return renderEmailShell({
    title: 'We received your inquiry - BINHI Concept',
    badgeText: 'INQUIRY RECEIVED',
    headline: 'Thank you for reaching out to us',
    bodyContent,
  });
}

/**
 * 2. Template: Admin Alert Email
 * Sent to administrators when a customer submits a contact inquiry.
 */
export function getAdminInquiryAlertHtml(data: InquiryEmailData): string {
  const safeName = escapeHtml(data.name);
  const safeEmail = escapeHtml(data.email);
  const safeEventType = escapeHtml(data.eventType);
  const safeDate = data.eventDate ? escapeHtml(data.eventDate) : 'None provided';
  const safeBudget = data.budget ? escapeHtml(data.budget) : 'None provided';
  const safeWebsite = data.website ? escapeHtml(data.website) : 'None';
  const safeMessage = escapeHtml(data.message).replace(/\n/g, '<br/>');

  const bodyContent = `
    <p class="text-muted" style="margin:0 0 20px 0; font-size:14px; color:#6B7280; line-height:1.65; font-family:Arial,Helvetica,sans-serif;">
      You have received a new customer inquiry submitted via the public Contact Us form.
    </p>

    <p class="text-muted-2" style="margin:0 0 8px 0; font-size:11px; font-weight:700; letter-spacing:1.5px; color:#9AA1AC; font-family:Arial,Helvetica,sans-serif;">CLIENT &amp; EVENT DETAILS</p>

    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" class="code-box" bgcolor="#ECEEF1" style="background-color:#ECEEF1; border:1px solid #E4E6EA; border-radius:8px; margin-bottom:24px;">
      <tr>
        <td style="padding:16px 20px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
            <tr>
              <td style="padding-bottom:10px; width:50%; vertical-align:top;">
                <div class="item-label" style="color:#9AA1AC; font-size:10px; font-weight:700; letter-spacing:1px; text-transform:uppercase; margin-bottom:2px;">Client Name</div>
                <div class="item-val" style="color:#24252C; font-size:13px; font-weight:700;">${safeName}</div>
              </td>
              <td style="padding-bottom:10px; width:50%; vertical-align:top;">
                <div class="item-label" style="color:#9AA1AC; font-size:10px; font-weight:700; letter-spacing:1px; text-transform:uppercase; margin-bottom:2px;">Client Email</div>
                <div class="item-val" style="color:#1090F8; font-size:13px; font-weight:600;"><a href="mailto:${safeEmail}" style="color:#1090F8; text-decoration:none;">${safeEmail}</a></div>
              </td>
            </tr>
            <tr>
              <td style="padding-bottom:10px; vertical-align:top;">
                <div class="item-label" style="color:#9AA1AC; font-size:10px; font-weight:700; letter-spacing:1px; text-transform:uppercase; margin-bottom:2px;">Event Type</div>
                <div class="item-val" style="color:#24252C; font-size:13px; font-weight:600;">${safeEventType}</div>
              </td>
              <td style="padding-bottom:10px; vertical-align:top;">
                <div class="item-label" style="color:#9AA1AC; font-size:10px; font-weight:700; letter-spacing:1px; text-transform:uppercase; margin-bottom:2px;">Target Date</div>
                <div class="item-val" style="color:#24252C; font-size:13px; font-weight:600;">${safeDate}</div>
              </td>
            </tr>
            <tr>
              <td style="padding-bottom:10px; vertical-align:top;">
                <div class="item-label" style="color:#9AA1AC; font-size:10px; font-weight:700; letter-spacing:1px; text-transform:uppercase; margin-bottom:2px;">Est. Budget</div>
                <div class="item-val" style="color:#24252C; font-size:13px; font-weight:600;">${safeBudget}</div>
              </td>
              <td style="padding-bottom:10px; vertical-align:top;">
                <div class="item-label" style="color:#9AA1AC; font-size:10px; font-weight:700; letter-spacing:1px; text-transform:uppercase; margin-bottom:2px;">Website / Social</div>
                <div class="item-val" style="color:#24252C; font-size:13px; font-weight:600;">${safeWebsite}</div>
              </td>
            </tr>
            <tr>
              <td colspan="2" style="padding-top:6px; vertical-align:top; border-top:1px dashed #D5D8DF;">
                <div class="item-label" style="color:#9AA1AC; font-size:10px; font-weight:700; letter-spacing:1px; text-transform:uppercase; margin-top:8px; margin-bottom:4px;">Client Message</div>
                <div style="color:#24252C; font-size:13px; line-height:1.6; font-family:Arial,Helvetica,sans-serif;">${safeMessage}</div>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>

    <p class="text-muted" style="margin:0 0 16px 0; font-size:13px; color:#6B7280; line-height:1.65; font-family:Arial,Helvetica,sans-serif;">
      This inquiry is recorded in the database and visible in the <strong>Admin Inquiry Inbox</strong> for review and direct reply.
    </p>
  `;

  return renderEmailShell({
    title: `New Inquiry from ${data.name} - BINHI Concept`,
    badgeText: 'NEW INQUIRY ALERT',
    headline: `New Inquiry: ${escapeHtml(data.name)} (${safeEventType})`,
    bodyContent,
  });
}

/**
 * 3. Template: Admin Reply Email
 * Sent to the customer when the admin replies from the Admin Inquiry Inbox.
 */
export function getAdminReplyHtml(data: InquiryReplyEmailData): string {
  const safeName = escapeHtml(data.recipientName);
  const safeReply = escapeHtml(data.replyMessage).replace(/\n/g, '<br/>');

  let originalSection = '';
  if (data.originalInquiry) {
    const safeOrigMsg = data.originalInquiry.message
      ? escapeHtml(data.originalInquiry.message).replace(/\n/g, '<br/>')
      : '';
    const safeOrigType = data.originalInquiry.eventType ? escapeHtml(data.originalInquiry.eventType) : '';
    const safeOrigDate = data.originalInquiry.eventDate ? escapeHtml(data.originalInquiry.eventDate) : '';

    originalSection = `
      <div style="margin-top:24px; padding:16px; background-color:#FAFAFB; border-left:3px solid #1090F8; border-radius:0 8px 8px 0;">
        <div style="font-size:11px; font-weight:700; color:#9AA1AC; letter-spacing:1px; text-transform:uppercase; margin-bottom:6px;">Your Original Inquiry (${safeOrigType}${safeOrigDate ? ` · ${safeOrigDate}` : ''})</div>
        <div style="font-size:12px; color:#6B7280; line-height:1.6; font-style:italic;">"${safeOrigMsg}"</div>
      </div>
    `;
  }

  const bodyContent = `
    <p class="text-muted" style="margin:0 0 20px 0; font-size:14px; color:#6B7280; line-height:1.65; font-family:Arial,Helvetica,sans-serif;">
      Hi <strong class="text-ink" style="color:#24252C;">${safeName}</strong>,
    </p>
    <p class="text-muted" style="margin:0 0 20px 0; font-size:14px; color:#6B7280; line-height:1.65; font-family:Arial,Helvetica,sans-serif;">
      Thank you for your patience. The BINHI Concept event production team has reviewed your inquiry and sent the following response:
    </p>

    <div class="code-box" style="background-color:#ECEEF1; border:1px solid #E4E6EA; border-radius:8px; padding:20px 24px; margin-bottom:20px;">
      <div style="font-size:14px; color:#24252C; line-height:1.75; font-family:Arial,Helvetica,sans-serif;">
        ${safeReply}
      </div>
    </div>

    ${originalSection}

    <p class="text-muted" style="margin:24px 0 0 0; font-size:13px; color:#6B7280; line-height:1.65; font-family:Arial,Helvetica,sans-serif;">
      If you would like to proceed with your booking, request adjustments, or set up a technical consultation, feel free to reply directly to this email or visit our website.
    </p>
  `;

  return renderEmailShell({
    title: 'Response to your BINHI Concept inquiry',
    badgeText: 'INQUIRY RESPONSE',
    headline: 'Response to your Event Inquiry',
    bodyContent,
  });
}

// ─── Reschedule System Email Templates ────────────────────────────────────────

export interface RescheduleRequestEmailData {
  bookingId: string;
  customerName: string;
  customerEmail: string;
  customerPhone?: string;
  packageName: string;
  originalDate: string;
  requestedDate: string;
  reason: string;
  venue?: string;
  totalCost?: string;
}

export interface RescheduleApprovalEmailData {
  customerName: string;
  customerEmail: string;
  bookingId: string;
  packageName: string;
  oldDate: string;
  newDate: string;
  venue?: string;
  adminNotes?: string;
  isDirectAdminReschedule?: boolean;
}

export interface RescheduleRejectionEmailData {
  customerName: string;
  customerEmail: string;
  bookingId: string;
  packageName: string;
  originalDate: string;
  requestedDate: string;
  adminNotes?: string;
}

/**
 * 4. Template: Admin Alert - Customer Reschedule Request
 * Sent to all system admins when a customer submits a reschedule request.
 */
export function getAdminRescheduleRequestAlertHtml(data: RescheduleRequestEmailData): string {
  const safeName = escapeHtml(data.customerName || 'Valued Customer');
  const safeEmail = escapeHtml(data.customerEmail);
  const safePhone = data.customerPhone ? escapeHtml(data.customerPhone) : 'Not provided';
  const safePkg = escapeHtml(data.packageName || 'Production Package');
  const safeRef = escapeHtml(data.bookingId);
  const safeOrigDate = escapeHtml(data.originalDate);
  const safeReqDate = escapeHtml(data.requestedDate);
  const safeReason = escapeHtml(data.reason || 'No reason provided').replace(/\n/g, '<br/>');
  const safeVenue = data.venue ? escapeHtml(data.venue) : 'Selected Venue';

  const bodyContent = `
    <p class="text-muted" style="margin:0 0 16px 0; font-size:14px; color:#6B7280; line-height:1.65; font-family:Arial,Helvetica,sans-serif;">
      A customer has submitted a <strong class="text-ink" style="color:#24252C;">booking reschedule request</strong> that requires your review and approval.
    </p>

    <!-- Highlighted Date Shift Card -->
    <div style="background-color:#F0F7FF; border:1px solid #BAE0FD; border-radius:10px; padding:18px 20px; margin-bottom:20px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
        <tr>
          <td width="48%" style="vertical-align:top;">
            <div style="font-size:10px; font-weight:700; color:#6B7280; letter-spacing:1px; text-transform:uppercase; margin-bottom:4px;">Current Schedule</div>
            <div style="font-size:14px; font-weight:700; color:#24252C; text-decoration:line-through; opacity:0.8;">${safeOrigDate}</div>
          </td>
          <td width="4%" align="center" style="vertical-align:middle; font-size:16px; font-weight:bold; color:#1090F8;">→</td>
          <td width="48%" style="vertical-align:top; padding-left:12px;">
            <div style="font-size:10px; font-weight:700; color:#1090F8; letter-spacing:1px; text-transform:uppercase; margin-bottom:4px;">Requested New Date</div>
            <div style="font-size:15px; font-weight:800; color:#1090F8;">${safeReqDate}</div>
          </td>
        </tr>
      </table>
    </div>

    <!-- Booking Summary Details -->
    <div class="code-box" style="background-color:#ECEEF1; border:1px solid #E4E6EA; border-radius:8px; padding:18px 22px; margin-bottom:20px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
        <tr>
          <td style="padding:4px 0;" class="item-label">Booking Reference</td>
          <td style="padding:4px 0; text-align:right;" class="item-val font-mono font-bold" style="font-family:monospace; color:#1090F8;">#${safeRef}</td>
        </tr>
        <tr>
          <td style="padding:4px 0;" class="item-label">Customer Name</td>
          <td style="padding:4px 0; text-align:right;" class="item-val">${safeName}</td>
        </tr>
        <tr>
          <td style="padding:4px 0;" class="item-label">Customer Contact</td>
          <td style="padding:4px 0; text-align:right;" class="item-val"><a href="mailto:${safeEmail}" style="color:#1090F8; text-decoration:none;">${safeEmail}</a> · ${safePhone}</td>
        </tr>
        <tr>
          <td style="padding:4px 0;" class="item-label">Production Package</td>
          <td style="padding:4px 0; text-align:right;" class="item-val">${safePkg}</td>
        </tr>
        <tr>
          <td style="padding:4px 0;" class="item-label">Venue Address</td>
          <td style="padding:4px 0; text-align:right;" class="item-val">${safeVenue}</td>
        </tr>
      </table>
    </div>

    <!-- Reason Box -->
    <div style="margin-bottom:24px;">
      <div class="item-label" style="color:#9AA1AC; font-size:10px; font-weight:700; letter-spacing:1px; text-transform:uppercase; margin-bottom:6px;">Customer Reason / Message</div>
      <div style="background-color:#FFFFFF; border:1px solid #E4E6EA; border-left:3px solid #1090F8; border-radius:4px 8px 8px 4px; padding:14px 18px; font-size:13px; color:#24252C; line-height:1.6;">
        "${safeReason}"
      </div>
    </div>

    <p class="text-muted" style="margin:0 0 20px 0; font-size:13px; color:#6B7280; line-height:1.6; font-family:Arial,Helvetica,sans-serif;">
      Please log in to the BINHI Concept Admin Dashboard to review the calendar availability and approve or reject this reschedule request.
    </p>

    <!-- CTA Button -->
    <table role="presentation" cellpadding="0" cellspacing="0" style="margin:20px 0 0 0;">
      <tr>
        <td align="center" bgcolor="#24252C" style="border-radius:24px;">
          <a href="${getAppBaseUrl()}" style="display:inline-block; padding:12px 28px; font-size:12px; font-weight:700; color:#FFFFFF; text-decoration:none; letter-spacing:0.5px; font-family:Arial,Helvetica,sans-serif;">
            Open Bookings Management →
          </a>
        </td>
      </tr>
    </table>
  `;

  return renderEmailShell({
    title: `Reschedule Request: ${safeName} (#${safeRef}) - BINHI Concept`,
    badgeText: 'RESCHEDULE REQUEST',
    headline: 'Booking Reschedule Request Received',
    bodyContent,
  });
}

/**
 * 5. Template: Customer Confirmation - Reschedule Approved / Updated
 * Sent to the customer when the admin approves their reschedule request or directly reschedules the booking.
 */
export function getCustomerRescheduleApprovedHtml(data: RescheduleApprovalEmailData): string {
  const safeName = escapeHtml(data.customerName || 'Valued Customer');
  const safeRef = escapeHtml(data.bookingId);
  const safePkg = escapeHtml(data.packageName || 'Production Package');
  const safeOldDate = escapeHtml(data.oldDate);
  const safeNewDate = escapeHtml(data.newDate);
  const safeVenue = data.venue ? escapeHtml(data.venue) : 'Selected Venue';
  const isDirect = data.isDirectAdminReschedule === true;

  const noteSection = data.adminNotes
    ? `
      <div style="margin:20px 0; padding:14px 18px; background-color:#FAFAFB; border-left:3px solid #10B981; border-radius:0 8px 8px 0;">
        <div style="font-size:10px; font-weight:700; color:#059669; letter-spacing:1px; text-transform:uppercase; margin-bottom:4px;">Note from BINHI Production Team</div>
        <div style="font-size:12px; color:#374151; line-height:1.6;">${escapeHtml(data.adminNotes).replace(/\n/g, '<br/>')}</div>
      </div>
    `
    : '';

  const bodyContent = `
    <p class="text-muted" style="margin:0 0 16px 0; font-size:14px; color:#6B7280; line-height:1.65; font-family:Arial,Helvetica,sans-serif;">
      Dear <strong class="text-ink" style="color:#24252C;">${safeName}</strong>,
    </p>
    <p class="text-muted" style="margin:0 0 20px 0; font-size:14px; color:#6B7280; line-height:1.65; font-family:Arial,Helvetica,sans-serif;">
      ${
        isDirect
          ? `Your event production reservation with <strong class="text-ink" style="color:#24252C;">BINHI Concept</strong> has been rescheduled to a new event date.`
          : `Great news! Your request to reschedule your event production booking with <strong class="text-ink" style="color:#24252C;">BINHI Concept</strong> has been <strong style="color:#059669;">approved and confirmed</strong>.`
      }
    </p>

    <!-- Confirmed Date Banner -->
    <div style="background-color:#ECFDF5; border:1.5px solid #A7F3D0; border-radius:12px; padding:20px 24px; margin-bottom:22px; text-align:center;">
      <div style="font-size:11px; font-weight:700; color:#059669; letter-spacing:1.5px; text-transform:uppercase; margin-bottom:4px;">
        Confirmed New Event Date
      </div>
      <div style="font-size:22px; font-weight:900; color:#065F46; font-family:Arial,Helvetica,sans-serif; margin-bottom:6px;">
        ${safeNewDate}
      </div>
      <div style="font-size:11px; color:#6B7280;">
        (Previous Schedule: <span style="text-decoration:line-through;">${safeOldDate}</span>)
      </div>
    </div>

    <!-- Booking Summary Details -->
    <div class="code-box" style="background-color:#ECEEF1; border:1px solid #E4E6EA; border-radius:8px; padding:18px 22px; margin-bottom:20px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
        <tr>
          <td style="padding:4px 0;" class="item-label">Booking Reference</td>
          <td style="padding:4px 0; text-align:right;" class="item-val" style="font-family:monospace; color:#1090F8; font-weight:bold;">#${safeRef}</td>
        </tr>
        <tr>
          <td style="padding:4px 0;" class="item-label">Production Package</td>
          <td style="padding:4px 0; text-align:right;" class="item-val">${safePkg}</td>
        </tr>
        <tr>
          <td style="padding:4px 0;" class="item-label">Venue Location</td>
          <td style="padding:4px 0; text-align:right;" class="item-val">${safeVenue}</td>
        </tr>
        <tr>
          <td style="padding:4px 0;" class="item-label">Production Status</td>
          <td style="padding:4px 0; text-align:right;" class="item-val" style="color:#059669; font-weight:bold;">Confirmed & Date Locked</td>
        </tr>
      </table>
    </div>

    ${noteSection}

    <p class="text-muted" style="margin:20px 0 0 0; font-size:13px; color:#6B7280; line-height:1.65; font-family:Arial,Helvetica,sans-serif;">
      All your package inclusions, staging equipment, logistics, and crew arrangements have been transferred to your new event date. You can view your updated timeline on your <strong>Booking Status Tracker</strong> anytime.
    </p>

    <!-- CTA Button -->
    <table role="presentation" cellpadding="0" cellspacing="0" style="margin:22px 0 0 0;">
      <tr>
        <td align="center" bgcolor="#24252C" style="border-radius:24px;">
          <a href="${getAppBaseUrl()}" style="display:inline-block; padding:12px 28px; font-size:12px; font-weight:700; color:#FFFFFF; text-decoration:none; letter-spacing:0.5px; font-family:Arial,Helvetica,sans-serif;">
            View Booking Tracker →
          </a>
        </td>
      </tr>
    </table>
  `;

  return renderEmailShell({
    title: `Reschedule Confirmed: ${safeNewDate} - BINHI Concept (#${safeRef})`,
    badgeText: 'SCHEDULE CONFIRMED',
    headline: 'Event Date Reschedule Confirmed',
    bodyContent,
  });
}

/**
 * 6. Template: Customer Notice - Reschedule Request Declined / Conflict
 * Sent to the customer if the requested reschedule date cannot be accommodated.
 */
export function getCustomerRescheduleRejectedHtml(data: RescheduleRejectionEmailData): string {
  const safeName = escapeHtml(data.customerName || 'Valued Customer');
  const safeRef = escapeHtml(data.bookingId);
  const safePkg = escapeHtml(data.packageName || 'Production Package');
  const safeOrigDate = escapeHtml(data.originalDate);
  const safeReqDate = escapeHtml(data.requestedDate);
  const safeAdminNotes = data.adminNotes ? escapeHtml(data.adminNotes).replace(/\n/g, '<br/>') : '';

  const bodyContent = `
    <p class="text-muted" style="margin:0 0 16px 0; font-size:14px; color:#6B7280; line-height:1.65; font-family:Arial,Helvetica,sans-serif;">
      Dear <strong class="text-ink" style="color:#24252C;">${safeName}</strong>,
    </p>
    <p class="text-muted" style="margin:0 0 20px 0; font-size:14px; color:#6B7280; line-height:1.65; font-family:Arial,Helvetica,sans-serif;">
      Thank you for contacting us regarding your booking <strong class="text-ink" style="color:#24252C;">#${safeRef}</strong>. We have reviewed your requested reschedule date (<strong style="color:#24252C;">${safeReqDate}</strong>). Unfortunately, we are unable to accommodate this specific date due to prior confirmed production bookings or equipment logistics.
    </p>

    <!-- Retained Date Notice -->
    <div style="background-color:#FFFBEB; border:1.5px solid #FDE68A; border-radius:12px; padding:18px 22px; margin-bottom:22px;">
      <div style="font-size:10px; font-weight:700; color:#B45309; letter-spacing:1px; text-transform:uppercase; margin-bottom:4px;">
        Your Current Schedule Remains Active
      </div>
      <div style="font-size:16px; font-weight:800; color:#92400E; margin-bottom:4px;">
        ${safeOrigDate}
      </div>
      <div style="font-size:11px; color:#78350F;">
        Your deposit and reservation for <strong>${safePkg}</strong> remain secured on this original date.
      </div>
    </div>

    ${
      safeAdminNotes
        ? `
      <div style="margin:20px 0; padding:14px 18px; background-color:#FAFAFB; border-left:3px solid #F59E0B; border-radius:0 8px 8px 0;">
        <div style="font-size:10px; font-weight:700; color:#B45309; letter-spacing:1px; text-transform:uppercase; margin-bottom:4px;">Message from Production Lead</div>
        <div style="font-size:12px; color:#374151; line-height:1.6;">${safeAdminNotes}</div>
      </div>
    `
        : ''
    }

    <p class="text-muted" style="margin:20px 0 0 0; font-size:13px; color:#6B7280; line-height:1.65; font-family:Arial,Helvetica,sans-serif;">
      If you would like to explore alternative dates, please check our live production calendar or reply directly to this email so our team can help you find an open date.
    </p>

    <!-- CTA Button -->
    <table role="presentation" cellpadding="0" cellspacing="0" style="margin:22px 0 0 0;">
      <tr>
        <td align="center" bgcolor="#24252C" style="border-radius:24px;">
          <a href="${getAppBaseUrl()}" style="display:inline-block; padding:12px 28px; font-size:12px; font-weight:700; color:#FFFFFF; text-decoration:none; letter-spacing:0.5px; font-family:Arial,Helvetica,sans-serif;">
            View Calendar Availability →
          </a>
        </td>
      </tr>
    </table>
  `;

  return renderEmailShell({
    title: `Reschedule Request Update: #${safeRef} - BINHI Concept`,
    badgeText: 'SCHEDULE UPDATE',
    headline: 'Reschedule Request Status Update',
    bodyContent,
  });
}

// ─── Cancellation & Refund System Email Templates ───────────────────────────

export interface CancellationRequestEmailData {
  bookingId: string;
  customerName: string;
  customerEmail: string;
  customerPhone?: string;
  packageName: string;
  eventDate: string;
  venue?: string;
  reason: string;
  paidAmount?: string;
  totalCost?: string;
  depositPaid?: string;
  policyNetRefund?: string;
  tierApplied?: string;
}

export interface CancellationRefundEmailData {
  customerName: string;
  customerEmail: string;
  bookingId: string;
  packageName: string;
  eventDate: string;
  venue?: string;
  refundAmount: string;
  refundChannel: string;
  refundReferenceNumber?: string;
  adminNotes?: string;
  isDirectAdminCancellation?: boolean;
  isDirectAdminCancel?: boolean;
  isPayMongoRefund?: boolean;
  reflectionDaysEstimate?: string;
  refundReceiptUrl?: string;
}

export interface CancellationRejectionEmailData {
  customerName: string;
  customerEmail: string;
  bookingId: string;
  packageName: string;
  eventDate: string;
  adminNotes?: string;
}

/**
 * 6. Template: Admin Alert - Customer Cancellation & Refund Request
 * Sent to all system admins when a customer requests to cancel their booking.
 */
export function getAdminCancellationRequestAlertHtml(data: CancellationRequestEmailData): string {
  const safeName = escapeHtml(data.customerName || 'Valued Customer');
  const safeEmail = escapeHtml(data.customerEmail);
  const safePhone = data.customerPhone ? escapeHtml(data.customerPhone) : 'Not provided';
  const safePkg = escapeHtml(data.packageName || 'Production Package');
  const safeRef = escapeHtml(data.bookingId);
  const safeDate = escapeHtml(data.eventDate);
  const safeReason = escapeHtml(data.reason || 'No reason provided').replace(/\n/g, '<br/>');
  const safeVenue = data.venue ? escapeHtml(data.venue) : 'Selected Venue';
  const safePaid = data.paidAmount ? escapeHtml(data.paidAmount) : 'N/A';
  const safePolicyRefund = data.policyNetRefund ? escapeHtml(data.policyNetRefund) : safePaid;
  const safeTier = data.tierApplied ? escapeHtml(data.tierApplied) : 'Standard Cancellation Tier';

  const bodyContent = `
    <p class="text-muted" style="margin:0 0 16px 0; font-size:14px; color:#6B7280; line-height:1.65; font-family:Arial,Helvetica,sans-serif;">
      A customer has submitted a <strong class="text-ink" style="color:#E11D48;">booking cancellation and refund request</strong> that requires your review in the Admin Dashboard.
    </p>

    <!-- Cancellation Highlight Card -->
    <div style="background-color:#FFF1F2; border:1.5px solid #FECDD3; border-radius:12px; padding:18px 20px; margin-bottom:20px;">
      <div style="font-size:10px; font-weight:700; color:#BE123C; letter-spacing:1px; text-transform:uppercase; margin-bottom:4px;">
        Policy Net Refund Recommendation
      </div>
      <div style="font-size:22px; font-weight:900; color:#BE123C; margin-bottom:4px;">
        ${safePolicyRefund}
      </div>
      <div style="font-size:12px; color:#881337; opacity:0.9;">
        Booking #${safeRef} · ${safePkg} · Event: <strong>${safeDate}</strong>
      </div>
    </div>

    <!-- Booking Summary Details -->
    <div class="code-box" style="background-color:#ECEEF1; border:1px solid #E4E6EA; border-radius:8px; padding:18px 22px; margin-bottom:20px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
        <tr>
          <td style="padding:4px 0;" class="item-label">Booking Reference</td>
          <td style="padding:4px 0; text-align:right;" class="item-val font-mono font-bold" style="font-family:monospace; color:#E11D48;">#${safeRef}</td>
        </tr>
        <tr>
          <td style="padding:4px 0;" class="item-label">Customer Name</td>
          <td style="padding:4px 0; text-align:right;" class="item-val">${safeName}</td>
        </tr>
        <tr>
          <td style="padding:4px 0;" class="item-label">Customer Contact</td>
          <td style="padding:4px 0; text-align:right;" class="item-val"><a href="mailto:${safeEmail}" style="color:#1090F8; text-decoration:none;">${safeEmail}</a> · ${safePhone}</td>
        </tr>
        <tr>
          <td style="padding:4px 0;" class="item-label">Production Package</td>
          <td style="padding:4px 0; text-align:right;" class="item-val">${safePkg}</td>
        </tr>
        <tr>
          <td style="padding:4px 0;" class="item-label">Venue Location</td>
          <td style="padding:4px 0; text-align:right;" class="item-val">${safeVenue}</td>
        </tr>
        <tr>
          <td style="padding:4px 0;" class="item-label">Amount Customer Paid</td>
          <td style="padding:4px 0; text-align:right; font-weight:700; color:#24252C;" class="item-val">${safePaid}</td>
        </tr>
        <tr>
          <td style="padding:4px 0;" class="item-label">Policy Tier Applied</td>
          <td style="padding:4px 0; text-align:right; font-weight:600; color:#4B5563;" class="item-val">${safeTier}</td>
        </tr>
        <tr>
          <td style="padding:4px 0;" class="item-label">Policy Net Refund</td>
          <td style="padding:4px 0; text-align:right; font-weight:800; color:#E11D48; font-size:14px;" class="item-val">${safePolicyRefund}</td>
        </tr>
      </table>
    </div>

    <!-- Reason Box -->
    <div style="margin-bottom:22px; padding:14px 18px; background-color:#FAFAFB; border-left:3px solid #E11D48; border-radius:0 8px 8px 0;">
      <div style="font-size:10px; font-weight:700; color:#BE123C; letter-spacing:1px; text-transform:uppercase; margin-bottom:4px;">Customer Cancellation Reason</div>
      <div style="font-size:12px; color:#374151; line-height:1.6; font-style:italic;">"${safeReason}"</div>
    </div>

    <p class="text-muted" style="margin:0 0 20px 0; font-size:12px; color:#6B7280; line-height:1.6; font-family:Arial,Helvetica,sans-serif;">
      Please log in to the BINHI Concept Admin Dashboard to review this cancellation request and disburse the refund via PayMongo or manual proof upload.
    </p>

    <!-- Action Button -->
    <table role="presentation" cellpadding="0" cellspacing="0">
      <tr>
        <td align="center" bgcolor="#E11D48" style="border-radius:24px;">
          <a href="${getAppBaseUrl()}" style="display:inline-block; padding:12px 28px; font-size:12px; font-weight:700; color:#FFFFFF; text-decoration:none; letter-spacing:0.5px; font-family:Arial,Helvetica,sans-serif;">
            Review in Admin Dashboard →
          </a>
        </td>
      </tr>
    </table>
  `;

  return renderEmailShell({
    title: `Cancellation Request: ${safeName} (#${safeRef}) - BINHI Concept`,
    badgeText: 'CANCELLATION REQUEST',
    headline: 'Booking Cancellation & Refund Request',
    bodyContent,
  });
}

/**
 * 7. Template: Customer Confirmation - Cancellation & Refund Processed
 * Sent to the customer when their booking cancellation and refund are processed.
 */
export function getCustomerCancellationRefundHtml(data: CancellationRefundEmailData): string {
  const safeName = escapeHtml(data.customerName || 'Valued Customer');
  const safePkg = escapeHtml(data.packageName || 'Production Package');
  const safeRef = escapeHtml(data.bookingId);
  const safeDate = escapeHtml(data.eventDate);
  const safeRefund = escapeHtml(data.refundAmount);
  const safeChannel = escapeHtml(data.refundChannel || 'PayMongo Original Payment');
  const safeRefNum = data.refundReferenceNumber ? escapeHtml(data.refundReferenceNumber) : null;
  const safeAdminNotes = data.adminNotes ? escapeHtml(data.adminNotes).replace(/\n/g, '<br/>') : '';
  const isPaymongo = safeChannel.toLowerCase().includes('paymongo');
  const reflectionTimeline = data.reflectionDaysEstimate || (isPaymongo ? '5 to 10 business days' : '1 to 2 business days');

  const bodyContent = `
    <p class="text-muted" style="margin:0 0 16px 0; font-size:14px; color:#6B7280; line-height:1.65; font-family:Arial,Helvetica,sans-serif;">
      Dear <strong class="text-ink" style="color:#24252C;">${safeName}</strong>,
    </p>
    <p class="text-muted" style="margin:0 0 20px 0; font-size:14px; color:#6B7280; line-height:1.65; font-family:Arial,Helvetica,sans-serif;">
      ${
        (data.isDirectAdminCancellation || data.isDirectAdminCancel)
          ? `Your booking <strong class="text-ink" style="color:#24252C;">#${safeRef}</strong> for <strong style="color:#24252C;">${safeDate}</strong> has been cancelled by our production team, and your refund has been processed.`
          : `Your request to cancel booking <strong class="text-ink" style="color:#24252C;">#${safeRef}</strong> has been approved and your refund has been successfully processed.`
      }
    </p>

    <!-- Refund Processed Highlight Card -->
    <div style="background-color:#FFF1F2; border:1.5px solid #FECDD3; border-radius:12px; padding:18px 22px; margin-bottom:22px;">
      <div style="font-size:10px; font-weight:700; color:#BE123C; letter-spacing:1px; text-transform:uppercase; margin-bottom:4px;">
        Refund Successfully Processed
      </div>
      <div style="font-size:22px; font-weight:900; color:#E11D48; margin-bottom:4px;">
        ${safeRefund}
      </div>
      <div style="font-size:12px; color:#881337; font-weight:600;">
        Disbursed via ${safeChannel}${safeRefNum ? ` · Ref #${safeRefNum}` : ''}
      </div>
    </div>

    <!-- Timeline & Important Notice -->
    <div style="background-color:#F8FAFC; border:1px solid #E2E8F0; border-radius:10px; padding:16px 18px; margin-bottom:20px;">
      <div style="font-size:11px; font-weight:700; color:#334155; text-transform:uppercase; letter-spacing:0.5px; margin-bottom:6px;">
        Refund Processing &amp; Reflection Timeline
      </div>
      <p style="margin:0; font-size:12px; color:#475569; line-height:1.6;">
        ${
          isPaymongo
            ? `For refunds issued back to your original payment method (Credit/Debit Card, GCash, or Maya via PayMongo), please allow <strong style="color:#0F172A;">${reflectionTimeline}</strong> for the credit to reflect back on your account or statement, depending on your bank/issuer's processing schedule.`
            : `Your refund was issued manually via <strong style="color:#0F172A;">${safeChannel}</strong>. Please check your account. The transaction proof has been verified and logged in our system.`
        }
      </p>
    </div>

    <!-- Booking & Refund Summary Details -->
    <div class="code-box" style="background-color:#ECEEF1; border:1px solid #E4E6EA; border-radius:8px; padding:18px 22px; margin-bottom:20px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
        <tr>
          <td style="padding:4px 0;" class="item-label">Booking Reference</td>
          <td style="padding:4px 0; text-align:right;" class="item-val font-mono font-bold" style="font-family:monospace; color:#24252C;">#${safeRef}</td>
        </tr>
        <tr>
          <td style="padding:4px 0;" class="item-label">Package Reserved</td>
          <td style="padding:4px 0; text-align:right;" class="item-val">${safePkg}</td>
        </tr>
        <tr>
          <td style="padding:4px 0;" class="item-label">Cancelled Event Date</td>
          <td style="padding:4px 0; text-align:right;" class="item-val text-muted" style="text-decoration:line-through; color:#9CA3AF;">${safeDate}</td>
        </tr>
        <tr>
          <td style="padding:4px 0;" class="item-label">Disbursement Method</td>
          <td style="padding:4px 0; text-align:right;" class="item-val font-semibold">${safeChannel}</td>
        </tr>
        ${
          safeRefNum
            ? `
        <tr>
          <td style="padding:4px 0;" class="item-label">Transaction Reference</td>
          <td style="padding:4px 0; text-align:right;" class="item-val font-mono">${safeRefNum}</td>
        </tr>
        `
            : ''
        }
        <tr>
          <td style="padding:4px 0;" class="item-label">Refund Status</td>
          <td style="padding:4px 0; text-align:right; font-weight:800; color:#E11D48;" class="item-val">REFUNDED</td>
        </tr>
      </table>
    </div>

    ${
      safeAdminNotes
        ? `
      <div style="margin:20px 0; padding:14px 18px; background-color:#FAFAFB; border-left:3px solid #E11D48; border-radius:0 8px 8px 0;">
        <div style="font-size:10px; font-weight:700; color:#BE123C; letter-spacing:1px; text-transform:uppercase; margin-bottom:4px;">Note from Production Administrator</div>
        <div style="font-size:12px; color:#374151; line-height:1.6;">${safeAdminNotes}</div>
      </div>
    `
        : ''
    }

    <p class="text-muted" style="margin:20px 0 0 0; font-size:12px; color:#6B7280; line-height:1.6; font-family:Arial,Helvetica,sans-serif;">
      We hope to have the opportunity to work with you on future events. If you have questions regarding this refund, feel free to reply directly to this email.
    </p>
  `;

  return renderEmailShell({
    title: `Booking Cancelled & Refund Processed: #${safeRef} - BINHI Concept`,
    badgeText: 'REFUND PROCESSED',
    headline: 'Booking Cancellation & Refund Notice',
    bodyContent,
  });
}

/**
 * 8. Template: Customer Notification - Cancellation Request Declined
 * Sent to the customer when their cancellation/refund request is declined.
 */
export function getCustomerCancellationRejectedHtml(data: CancellationRejectionEmailData): string {
  const safeName = escapeHtml(data.customerName || 'Valued Customer');
  const safePkg = escapeHtml(data.packageName || 'Production Package');
  const safeRef = escapeHtml(data.bookingId);
  const safeDate = escapeHtml(data.eventDate);
  const safeAdminNotes = data.adminNotes ? escapeHtml(data.adminNotes).replace(/\n/g, '<br/>') : '';

  const bodyContent = `
    <p class="text-muted" style="margin:0 0 16px 0; font-size:14px; color:#6B7280; line-height:1.65; font-family:Arial,Helvetica,sans-serif;">
      Dear <strong class="text-ink" style="color:#24252C;">${safeName}</strong>,
    </p>
    <p class="text-muted" style="margin:0 0 20px 0; font-size:14px; color:#6B7280; line-height:1.65; font-family:Arial,Helvetica,sans-serif;">
      Thank you for reaching out. We have reviewed your cancellation request for booking <strong class="text-ink" style="color:#24252C;">#${safeRef}</strong>. Regrettably, we are unable to process this cancellation request at this time.
    </p>

    <!-- Secured Booking Notice -->
    <div style="background-color:#FFFBEB; border:1.5px solid #FDE68A; border-radius:12px; padding:18px 22px; margin-bottom:22px;">
      <div style="font-size:10px; font-weight:700; color:#B45309; letter-spacing:1px; text-transform:uppercase; margin-bottom:4px;">
        Your Event Reservation Remains Active
      </div>
      <div style="font-size:16px; font-weight:800; color:#92400E; margin-bottom:4px;">
        ${safeDate}
      </div>
      <div style="font-size:11px; color:#78350F;">
        Your reservation for <strong>${safePkg}</strong> remains confirmed in our production schedule.
      </div>
    </div>

    ${
      safeAdminNotes
        ? `
      <div style="margin:20px 0; padding:14px 18px; background-color:#FAFAFB; border-left:3px solid #F59E0B; border-radius:0 8px 8px 0;">
        <div style="font-size:10px; font-weight:700; color:#B45309; letter-spacing:1px; text-transform:uppercase; margin-bottom:4px;">Explanation from Production Team</div>
        <div style="font-size:12px; color:#374151; line-height:1.6;">${safeAdminNotes}</div>
      </div>
    `
        : ''
    }

    <p class="text-muted" style="margin:20px 0 0 0; font-size:13px; color:#6B7280; line-height:1.65; font-family:Arial,Helvetica,sans-serif;">
      If you need to discuss rescheduling or have questions regarding our cancellation policy, please reply directly to this email or contact our support team.
    </p>
  `;

  return renderEmailShell({
    title: `Cancellation Request Status: #${safeRef} - BINHI Concept`,
    badgeText: 'CANCELLATION UPDATE',
    headline: 'Cancellation Request Status Update',
    bodyContent,
  });
}

/**
 * 9. Data interface for Confirmed Booking Notifications
 */
export interface BookingConfirmationEmailData {
  bookingId: string;
  paymongoReference?: string;
  customerName: string;
  customerEmail: string;
  customerPhone?: string;
  packageName: string;
  packageTag?: string;
  eventType: string;
  eventDate: string;
  startTime?: string;
  endTime?: string;
  venueAddress: string;
  totalCost: number | string;
  depositAmount: number | string;
  remainingBalance?: number | string;
  paymentChannel?: string;
  isFullyPaid?: boolean;
  selectedAddons?: string[];
  inclusions?: string[];
  balancePaymentMethod?: string;
  trackerUrl?: string;
}

/**
 * 10. Template: Official Customer Booking Confirmation & Certificate of Reservation
 * Sent to the customer immediately upon booking confirmation or deposit approval.
 */
export function getBookingConfirmationEmailHtml(data: BookingConfirmationEmailData): string {
  const safeName = escapeHtml(data.customerName || 'Valued Client');
  const safeRef = escapeHtml(data.paymongoReference || data.bookingId);
  const safePkg = escapeHtml(data.packageName || 'Event Production Package');
  const safeTag = data.packageTag ? escapeHtml(data.packageTag) : 'Sound, Lighting & Visual Staging';
  const safeType = escapeHtml(data.eventType || 'Event Production');
  const safeDate = escapeHtml(data.eventDate);
  const safeStartTime = data.startTime ? escapeHtml(data.startTime) : '1:00 PM';
  const safeEndTime = data.endTime ? escapeHtml(data.endTime) : '6:00 PM';
  const safeVenue = escapeHtml(data.venueAddress || 'Selected Venue Location');
  const safeChannel = escapeHtml(data.paymentChannel || 'PayMongo / Bank Payment');
  const safeBalanceMethod = escapeHtml(data.balancePaymentMethod || 'Cash on Site / Event Day');

  const totalNum = typeof data.totalCost === 'number' ? data.totalCost : parseFloat(String(data.totalCost).replace(/[^0-9.]/g, '')) || 0;
  const depositNum = typeof data.depositAmount === 'number' ? data.depositAmount : parseFloat(String(data.depositAmount).replace(/[^0-9.]/g, '')) || 0;
  const isFull = Boolean(data.isFullyPaid || depositNum >= totalNum);
  const remainingNum = isFull ? 0 : Math.max(0, totalNum - depositNum);

  const trackerLink = data.trackerUrl || `${getAppBaseUrl()}/?page=booking-status&ref=${encodeURIComponent(safeRef)}`;

  const bodyContent = `
    <p class="text-muted" style="margin:0 0 16px 0; font-size:14px; color:#6B7280; line-height:1.65; font-family:Arial,Helvetica,sans-serif;">
      Dear <strong class="text-ink" style="color:#24252C;">${safeName}</strong>,
    </p>
    <p class="text-muted" style="margin:0 0 22px 0; font-size:14px; color:#6B7280; line-height:1.65; font-family:Arial,Helvetica,sans-serif;">
      We are thrilled to officially confirm your event production booking with <strong class="text-ink" style="color:#24252C;">BINHI Concept Lights &amp; Sounds</strong>. Your date has been locked into our master production calendar, and equipment assets have been allocated for your setup.
    </p>

    <!-- ── Official Confirmation Certificate Card ── -->
    <div style="background-color:#ECFDF5; border:1.5px solid #A7F3D0; border-radius:14px; padding:22px; margin-bottom:24px; text-align:center;">
      <div style="display:inline-block; width:36px; height:36px; border-radius:50%; background-color:#10B981; color:#FFFFFF; font-size:20px; font-weight:bold; line-height:36px; margin-bottom:10px;">
        ✓
      </div>
      <div style="font-size:11px; font-weight:800; color:#065F46; letter-spacing:1.5px; text-transform:uppercase; margin-bottom:4px;">
        Official Certificate of Reservation
      </div>
      <div style="font-size:24px; font-weight:900; color:#047857; margin-bottom:6px; font-family:Arial,Helvetica,sans-serif;">
        RESERVATION CONFIRMED
      </div>
      <div style="font-size:12px; color:#065F46; font-weight:600;">
        Booking Reference: <strong style="font-family:monospace; font-size:14px; color:#064E3B;">#${safeRef}</strong>
      </div>
    </div>

    <!-- ── Schedule & Venue Specifications ── -->
    <div style="background-color:#F8FAFC; border:1px solid #E2E8F0; border-radius:10px; padding:18px 20px; margin-bottom:20px;">
      <div style="font-size:11px; font-weight:700; color:#334155; text-transform:uppercase; letter-spacing:0.8px; margin-bottom:12px;">
        📅 Event Schedule &amp; Venue Details
      </div>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="font-size:13px; font-family:Arial,Helvetica,sans-serif;">
        <tr>
          <td style="padding:5px 0; color:#64748B; width:35%;">Event Date:</td>
          <td style="padding:5px 0; text-align:right; font-weight:700; color:#0F172A;">${safeDate}</td>
        </tr>
        <tr>
          <td style="padding:5px 0; color:#64748B;">Event Proper Time:</td>
          <td style="padding:5px 0; text-align:right; font-weight:700; color:#0F172A;">${safeStartTime} – ${safeEndTime}</td>
        </tr>
        <tr>
          <td style="padding:5px 0; color:#64748B;">Crew Call Time:</td>
          <td style="padding:5px 0; text-align:right; font-weight:600; color:#2563EB;">~2 Hours Prior to Event</td>
        </tr>
        <tr>
          <td style="padding:5px 0; color:#64748B;">Event Type:</td>
          <td style="padding:5px 0; text-align:right; font-weight:600; color:#0F172A;">${safeType}</td>
        </tr>
        <tr>
          <td style="padding:5px 0; color:#64748B; vertical-align:top;">Venue Location:</td>
          <td style="padding:5px 0; text-align:right; font-weight:600; color:#0F172A;">${safeVenue}</td>
        </tr>
      </table>
    </div>

    <!-- ── Package Inclusions & Production Summary ── -->
    <div class="code-box" style="background-color:#ECEEF1; border:1px solid #E4E6EA; border-radius:10px; padding:18px 20px; margin-bottom:20px;">
      <div style="font-size:11px; font-weight:700; color:#24252C; text-transform:uppercase; letter-spacing:0.8px; margin-bottom:12px;">
        📦 Package &amp; Equipment Inclusions
      </div>
      <div style="font-size:14px; font-weight:800; color:#24252C; margin-bottom:4px;">
        ${safePkg}
      </div>
      <div style="font-size:11px; color:#6B7280; margin-bottom:12px;">
        ${safeTag}
      </div>

      ${
        Array.isArray(data.inclusions) && data.inclusions.length > 0
          ? `
        <div style="font-size:11px; font-weight:700; color:#374151; margin-bottom:6px;">Standard Inclusions:</div>
        <ul style="margin:0 0 12px 0; padding-left:18px; font-size:12px; color:#4B5563; line-height:1.6;">
          ${data.inclusions.map((inc) => `<li>${escapeHtml(inc)}</li>`).join('')}
        </ul>
      `
          : ''
      }

      ${
        Array.isArray(data.selectedAddons) && data.selectedAddons.length > 0
          ? `
        <div style="font-size:11px; font-weight:700; color:#374151; margin-bottom:6px;">Selected Add-ons &amp; Upgrades:</div>
        <ul style="margin:0; padding-left:18px; font-size:12px; color:#4B5563; line-height:1.6;">
          ${data.selectedAddons.map((addon) => `<li><strong>${escapeHtml(addon)}</strong></li>`).join('')}
        </ul>
      `
          : ''
      }
    </div>

    <!-- ── Financial Summary & Payment Breakdown ── -->
    <div style="background-color:#FFFFFF; border:1.5px solid #E2E8F0; border-radius:10px; padding:18px 20px; margin-bottom:24px;">
      <div style="font-size:11px; font-weight:700; color:#334155; text-transform:uppercase; letter-spacing:0.8px; margin-bottom:12px;">
        💳 Payment &amp; Financial Ledger
      </div>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="font-size:13px; font-family:Arial,Helvetica,sans-serif;">
        <tr>
          <td style="padding:4px 0; color:#64748B;">Total Booking Cost:</td>
          <td style="padding:4px 0; text-align:right; font-weight:700; color:#0F172A;">₱${totalNum.toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
        </tr>
        <tr>
          <td style="padding:4px 0; color:#059669; font-weight:600;">Amount Paid / Deposit:</td>
          <td style="padding:4px 0; text-align:right; font-weight:700; color:#059669;">₱${depositNum.toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
        </tr>
        <tr>
          <td style="padding:4px 0; color:#64748B;">Payment Channel:</td>
          <td style="padding:4px 0; text-align:right; font-weight:600; color:#0F172A;">${safeChannel}</td>
        </tr>
        <tr style="border-top:1px solid #E2E8F0;">
          <td style="padding:8px 0 4px 0; font-weight:700; color:#0F172A;">Remaining Balance:</td>
          <td style="padding:8px 0 4px 0; text-align:right; font-weight:800; font-size:14px; color:${isFull ? '#059669' : '#D97706'};">
            ${isFull ? '₱0.00 (FULLY PAID)' : `₱${remainingNum.toLocaleString('en-US', { minimumFractionDigits: 2 })}`}
          </td>
        </tr>
        ${
          !isFull
            ? `
        <tr>
          <td style="padding:2px 0; color:#64748B; font-size:11px;">Balance Settlement:</td>
          <td style="padding:2px 0; text-align:right; font-size:11px; color:#475569;">${safeBalanceMethod}</td>
        </tr>
        `
            : ''
        }
      </table>
    </div>

    <!-- ── Live Tracking CTA Button ── -->
    <div style="text-align:center; margin:28px 0;">
      <a
        href="${trackerLink}"
        target="_blank"
        style="display:inline-block; background-color:#24252C; color:#FFFFFF; font-size:13px; font-weight:700; text-decoration:none; padding:14px 32px; border-radius:9999px; letter-spacing:0.3px;"
      >
        Track Booking &amp; Production Timeline →
      </a>
      <div style="font-size:11px; color:#9CA3AF; margin-top:8px;">
        Monitor crew dispatch, gear rigging status, and digital sign-off anytime.
      </div>
    </div>

    <!-- ── Production Notice & Support ── -->
    <p class="text-muted" style="margin:20px 0 0 0; font-size:12px; color:#6B7280; line-height:1.6; font-family:Arial,Helvetica,sans-serif;">
      Need to make adjustments, submit program itineraries, or coordinate venue ingress guidelines? Reply directly to this email or contact us at <a href="mailto:admin@binhiconcept.ph" style="color:#2563EB; text-decoration:none;">admin@binhiconcept.ph</a>.
    </p>
  `;

  return renderEmailShell({
    title: `Booking Confirmed: #${safeRef} - ${safeDate} - BINHI Concept`,
    badgeText: 'BOOKING CONFIRMED',
    headline: 'Official Event Booking Confirmation',
    bodyContent,
  });
}

/**
 * 11. Template: Admin Alert - New Booking Confirmed
 * Sent to System Administrators when a customer confirms a booking.
 */
export function getAdminNewBookingConfirmationAlertHtml(data: BookingConfirmationEmailData): string {
  const safeName = escapeHtml(data.customerName || 'Client');
  const safeRef = escapeHtml(data.paymongoReference || data.bookingId);
  const safePkg = escapeHtml(data.packageName || 'Production Package');
  const safeDate = escapeHtml(data.eventDate);
  const safeVenue = escapeHtml(data.venueAddress || 'Venue');
  const safeEmail = escapeHtml(data.customerEmail);
  const safePhone = data.customerPhone ? escapeHtml(data.customerPhone) : 'N/A';
  const totalNum = typeof data.totalCost === 'number' ? data.totalCost : parseFloat(String(data.totalCost).replace(/[^0-9.]/g, '')) || 0;
  const depositNum = typeof data.depositAmount === 'number' ? data.depositAmount : parseFloat(String(data.depositAmount).replace(/[^0-9.]/g, '')) || 0;

  const bodyContent = `
    <p class="text-muted" style="margin:0 0 16px 0; font-size:14px; color:#6B7280; line-height:1.65; font-family:Arial,Helvetica,sans-serif;">
      A new event production booking has been <strong class="text-ink" style="color:#24252C;">confirmed &amp; scheduled</strong> in the system.
    </p>

    <div style="background-color:#F0FDF4; border:1px solid #BBF7D0; border-radius:10px; padding:16px 18px; margin-bottom:20px;">
      <div style="font-size:10px; font-weight:700; color:#15803D; text-transform:uppercase; letter-spacing:1px; margin-bottom:4px;">
        Confirmed Reservation
      </div>
      <div style="font-size:18px; font-weight:800; color:#166534;">
        ${safeName} · #${safeRef}
      </div>
      <div style="font-size:12px; color:#14532D; margin-top:2px;">
        ${safePkg} — Event Date: <strong>${safeDate}</strong>
      </div>
    </div>

    <div class="code-box" style="background-color:#ECEEF1; border:1px solid #E4E6EA; border-radius:8px; padding:16px 18px; margin-bottom:20px; font-size:12px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
        <tr>
          <td style="padding:4px 0; color:#6B7280;">Customer:</td>
          <td style="padding:4px 0; text-align:right; font-weight:700; color:#24252C;">${safeName}</td>
        </tr>
        <tr>
          <td style="padding:4px 0; color:#6B7280;">Email:</td>
          <td style="padding:4px 0; text-align:right; font-family:monospace; color:#24252C;">${safeEmail}</td>
        </tr>
        <tr>
          <td style="padding:4px 0; color:#6B7280;">Contact:</td>
          <td style="padding:4px 0; text-align:right; color:#24252C;">${safePhone}</td>
        </tr>
        <tr>
          <td style="padding:4px 0; color:#6B7280;">Venue:</td>
          <td style="padding:4px 0; text-align:right; font-weight:600; color:#24252C;">${safeVenue}</td>
        </tr>
        <tr>
          <td style="padding:4px 0; color:#6B7280;">Total Package Cost:</td>
          <td style="padding:4px 0; text-align:right; font-weight:700; color:#24252C;">₱${totalNum.toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
        </tr>
        <tr>
          <td style="padding:4px 0; color:#6B7280;">Deposit Collected:</td>
          <td style="padding:4px 0; text-align:right; font-weight:700; color:#15803D;">₱${depositNum.toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
        </tr>
      </table>
    </div>

    <p class="text-muted" style="margin:20px 0 0 0; font-size:12px; color:#6B7280; line-height:1.6; font-family:Arial,Helvetica,sans-serif;">
      Please assign physical equipment serials and stage crew in the Admin Dashboard.
    </p>
  `;

  return renderEmailShell({
    title: `[New Confirmed Booking] #${safeRef} - ${safeName} (${safeDate})`,
    badgeText: 'NEW CONFIRMED BOOKING',
    headline: 'New Event Booking Scheduled',
    bodyContent,
  });
}

export interface PartnerOtpEmailData {
  email: string;
  partnerName?: string;
  otpCode: string;
  type: 'registration' | 'login';
}

/**
 * Branded OTP Verification Email for BINHI Partner Registration & Portal Login
 */
export function getPartnerOtpEmailHtml(data: PartnerOtpEmailData): string {
  const isReg = data.type === 'registration';
  const safeName = escapeHtml(data.partnerName || 'Partner / Coordinator');
  const safeEmail = escapeHtml(data.email);
  const safeCode = escapeHtml(data.otpCode);

  const title = isReg
    ? `${safeCode} is your BINHI Partner Program verification code`
    : `${safeCode} is your BINHI Partner Portal sign-in code`;

  const badgeText = isReg ? 'PARTNER REGISTRATION VERIFICATION' : 'PARTNER PORTAL AUTHENTICATION';
  const headline = isReg ? 'Verify Your Coordinator Email' : 'Sign In to Your Partner Portal';

  const bodyContent = `
    <p class="text-ink" style="margin:0 0 16px 0; font-size:14px; line-height:1.6; color:#24252C; font-family:Arial,Helvetica,sans-serif;">
      Hello <strong>${safeName}</strong>,
    </p>
    <p class="text-muted" style="margin:0 0 20px 0; font-size:13px; line-height:1.6; color:#6B7280; font-family:Arial,Helvetica,sans-serif;">
      ${
        isReg
          ? 'Thank you for joining the <strong>BINHI Concept Partner Program</strong>. Use the 6-digit verification code below to verify your email address and activate your partner portal.'
          : 'You requested security authentication to access your <strong>BINHI Concept Partner Portal</strong>. Enter the 6-digit verification code below to complete your sign-in.'
      }
    </p>

    <!-- OTP Code Display Card -->
    <div style="background: linear-gradient(135deg, #F0F7FF 0%, #E6F0FA 100%); border: 2px solid #BAE0FD; border-radius: 12px; padding: 24px 20px; text-align: center; margin: 24px 0;">
      <div style="font-size: 11px; font-weight: 800; letter-spacing: 2px; text-transform: uppercase; color: #0284C7; margin-bottom: 8px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
        Your 6-Digit Verification Code
      </div>
      <div style="font-family: 'Courier New', Courier, monospace; font-size: 36px; font-weight: 900; letter-spacing: 8px; color: #0C4A6E; line-height: 1.2;">
        ${safeCode}
      </div>
      <div style="font-size: 11px; color: #0369A1; margin-top: 10px; font-family: Arial, sans-serif;">
        This code expires in 10 minutes. Please do not share it with anyone.
      </div>
    </div>

    <div class="code-box" style="background-color:#ECEEF1; border:1px solid #E4E6EA; border-radius:8px; padding:12px 16px; margin:20px 0; font-size:11px; color:#6B7280; font-family:Arial,sans-serif;">
      <strong style="color:#24252C;">Security Notice:</strong> If you did not request this verification code, please ignore this email or contact <a href="mailto:admin@binhiconcept.ph" style="color:#1090F8; text-decoration:none;">admin@binhiconcept.ph</a> immediately.
    </div>
  `;

  return renderEmailShell({
    title,
    badgeText,
    headline,
    bodyContent,
  });
}

export interface PartnerApprovalEmailData {
  partnerName: string;
  email: string;
  referralCode: string;
  commissionRate: number;
  clientDiscountRate: number;
  loginUrl?: string;
  approvedBy?: string;
}

export interface PartnerRejectionEmailData {
  partnerName: string;
  email: string;
  reason?: string;
}

/**
 * Branded Email Notification when an Affiliate Partner Registration is Approved by Admin
 */
export function getPartnerApprovalEmailHtml(data: PartnerApprovalEmailData): string {
  const safeName = escapeHtml(data.partnerName || 'Partner / Coordinator');
  const safeCode = escapeHtml(data.referralCode);
  const commRate = data.commissionRate || 5;
  const discRate = data.clientDiscountRate || 5;
  const loginUrl = escapeHtml(data.loginUrl || `${window.location.origin}/partner-login`);

  const title = `Congratulations! Your BINHI Partner Account is Approved (${safeCode})`;
  const badgeText = 'PARTNER REGISTRATION APPROVED';
  const headline = 'Welcome to BINHI Partner Network!';

  const bodyContent = `
    <p class="text-ink" style="margin:0 0 16px 0; font-size:14px; line-height:1.6; color:#24252C; font-family:Arial,Helvetica,sans-serif;">
      Hello <strong>${safeName}</strong>,
    </p>
    <p class="text-muted" style="margin:0 0 20px 0; font-size:13px; line-height:1.6; color:#6B7280; font-family:Arial,Helvetica,sans-serif;">
      Great news! Your application to join the <strong>BINHI Concept Affiliate &amp; Coordinator Program</strong> has been reviewed and <span style="color:#059669; font-weight:700;">APPROVED</span> by our administration team.
    </p>

    <!-- Partner Program Benefits Box -->
    <div style="background: linear-gradient(135deg, #F0FDF4 0%, #ECFDF5 100%); border: 2px solid #A7F3D0; border-radius: 12px; padding: 24px 20px; text-align: center; margin: 24px 0;">
      <div style="font-size: 11px; font-weight: 800; letter-spacing: 2px; text-transform: uppercase; color: #047857; margin-bottom: 8px; font-family: Arial, sans-serif;">
        Your Official Client Promo Code
      </div>
      <div style="font-family: 'Courier New', Courier, monospace; font-size: 32px; font-weight: 900; letter-spacing: 6px; color: #064E3B; line-height: 1.2;">
        ${safeCode}
      </div>
      <div style="font-size: 12px; color: #065F46; margin-top: 10px; font-family: Arial, sans-serif; font-weight: 600;">
        Clients get <strong>${discRate}% OFF</strong> · You earn <strong>${commRate}% Commission</strong>
      </div>
    </div>

    <!-- Quick Overview Table -->
    <div class="divider" style="border-top: 1px solid #E4E6EA; margin: 20px 0; padding-top: 16px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
        <tr>
          <td style="padding: 6px 0; font-size: 12px; color: #6B7280; font-family: Arial, sans-serif;">Commission Rate:</td>
          <td align="right" style="padding: 6px 0; font-size: 12px; font-weight: 700; color: #059669; font-family: Arial, sans-serif;">${commRate}% per confirmed event</td>
        </tr>
        <tr>
          <td style="padding: 6px 0; font-size: 12px; color: #6B7280; font-family: Arial, sans-serif;">Client Checkout Discount:</td>
          <td align="right" style="padding: 6px 0; font-size: 12px; font-weight: 700; color: #2563EB; font-family: Arial, sans-serif;">${discRate}% OFF instant discount</td>
        </tr>
        <tr>
          <td style="padding: 6px 0; font-size: 12px; color: #6B7280; font-family: Arial, sans-serif;">Payout Method:</td>
          <td align="right" style="padding: 6px 0; font-size: 12px; font-weight: 700; color: #24252C; font-family: Arial, sans-serif;">Direct GCash / Maya / Bank Disbursals</td>
        </tr>
      </table>
    </div>

    <!-- Sign In CTA Button -->
    <div style="text-align: center; margin: 28px 0 20px 0;">
      <a href="${loginUrl}" style="background-color: #24252C; color: #FFFFFF; font-size: 13px; font-weight: 700; text-decoration: none; padding: 14px 28px; border-radius: 9999px; display: inline-block; font-family: Arial, sans-serif; letter-spacing: 0.5px;">
        Sign In to Your Partner Portal &rarr;
      </a>
    </div>

    <div class="code-box" style="background-color:#ECEEF1; border:1px solid #E4E6EA; border-radius:8px; padding:12px 16px; margin:20px 0; font-size:11px; color:#6B7280; font-family:Arial,sans-serif;">
      <strong style="color:#24252C;">Need Support?</strong> If you have any questions regarding your client referrals or equipment staging inquiries, contact our team at <a href="mailto:admin@binhiconcept.ph" style="color:#1090F8; text-decoration:none;">admin@binhiconcept.ph</a>.
    </div>
  `;

  return renderEmailShell({
    title,
    badgeText,
    headline,
    bodyContent,
  });
}

/**
 * Branded Email Notification when an Affiliate Partner Registration is Rejected
 */
export function getPartnerRejectionEmailHtml(data: PartnerRejectionEmailData): string {
  const safeName = escapeHtml(data.partnerName || 'Applicant');
  const safeReason = escapeHtml(data.reason || 'Information provided did not meet our current partner program requirements.');

  const title = 'Update on your BINHI Partner Program Application';
  const badgeText = 'PARTNER APPLICATION STATUS';
  const headline = 'Partner Application Update';

  const bodyContent = `
    <p class="text-ink" style="margin:0 0 16px 0; font-size:14px; line-height:1.6; color:#24252C; font-family:Arial,Helvetica,sans-serif;">
      Hello <strong>${safeName}</strong>,
    </p>
    <p class="text-muted" style="margin:0 0 20px 0; font-size:13px; line-height:1.6; color:#6B7280; font-family:Arial,Helvetica,sans-serif;">
      Thank you for your interest in joining the <strong>BINHI Concept Partner Program</strong>. After careful review of your application, we are unable to approve your coordinator account at this time.
    </p>

    <div style="background-color: #FEF2F2; border: 1px solid #FECACA; border-radius: 8px; padding: 16px; margin: 20px 0; font-size: 12px; color: #991B1B; font-family: Arial, sans-serif;">
      <strong>Note from Administration:</strong><br>
      ${safeReason}
    </div>

    <p class="text-muted" style="margin:0 0 20px 0; font-size:12px; line-height:1.6; color:#6B7280; font-family:Arial,Helvetica,sans-serif;">
      If you believe this was an error or if your business details have changed, you may reply to this email or reapply in the future.
    </p>
  `;

  return renderEmailShell({
    title,
    badgeText,
    headline,
    bodyContent,
  });
}

/**
 * Data interface for Booking Declined & Refunded Notifications
 */
export interface BookingDeclinedEmailData {
  bookingId: string;
  paymongoReference?: string;
  customerName: string;
  customerEmail: string;
  customerPhone?: string;
  packageName: string;
  eventType?: string;
  eventDate: string;
  totalCost: number | string;
  depositAmount: number | string;
  refundAmount: number | string;
  refundReference?: string;
  declineReason?: string;
  adminNotes?: string;
}

/**
 * 12. Template: Customer Notification - Downpayment Secured & Reservation Under Technical Review
 * Sent immediately after successful PayMongo checkout.
 */
export function getDownpaymentUnderReviewEmailHtml(data: BookingConfirmationEmailData): string {
  const safeName = escapeHtml(data.customerName || 'Valued Client');
  const safeRef = escapeHtml(data.paymongoReference || data.bookingId);
  const safePkg = escapeHtml(data.packageName || 'Event Production Package');
  const safeDate = escapeHtml(data.eventDate);
  const safeStartTime = data.startTime ? escapeHtml(data.startTime) : '1:00 PM';
  const safeEndTime = data.endTime ? escapeHtml(data.endTime) : '6:00 PM';
  const safeVenue = escapeHtml(data.venueAddress || 'Selected Venue Location');
  const safeChannel = escapeHtml(data.paymentChannel || 'PayMongo Online Payment');

  const totalNum = typeof data.totalCost === 'number' ? data.totalCost : parseFloat(String(data.totalCost).replace(/[^0-9.]/g, '')) || 0;
  const depositNum = typeof data.depositAmount === 'number' ? data.depositAmount : parseFloat(String(data.depositAmount).replace(/[^0-9.]/g, '')) || 0;
  const trackerLink = data.trackerUrl || `${getAppBaseUrl()}/?page=booking-status&ref=${encodeURIComponent(safeRef)}`;

  const bodyContent = `
    <p class="text-muted" style="margin:0 0 16px 0; font-size:14px; color:#6B7280; line-height:1.65; font-family:Arial,Helvetica,sans-serif;">
      Dear <strong class="text-ink" style="color:#24252C;">${safeName}</strong>,
    </p>
    <p class="text-muted" style="margin:0 0 20px 0; font-size:14px; color:#6B7280; line-height:1.65; font-family:Arial,Helvetica,sans-serif;">
      Thank you for choosing <strong>BINHI Concept Lights &amp; Sounds</strong>. We have successfully received your initial downpayment of <strong class="text-ink" style="color:#059669;">₱${depositNum.toLocaleString('en-US', { minimumFractionDigits: 2 })}</strong> via ${safeChannel}.
    </p>

    <!-- ── Under Technical Review Status Card ── -->
    <div style="background-color:#FEF3C7; border:1.5px solid #FCD34D; border-radius:14px; padding:20px; margin-bottom:24px; text-align:center;">
      <div style="display:inline-block; width:36px; height:36px; border-radius:50%; background-color:#D97706; color:#FFFFFF; font-size:18px; font-weight:bold; line-height:36px; margin-bottom:8px;">
        ⏳
      </div>
      <div style="font-size:11px; font-weight:800; color:#92400E; letter-spacing:1.5px; text-transform:uppercase; margin-bottom:4px;">
        Reservation Held &amp; Under Technical Assessment
      </div>
      <div style="font-size:20px; font-weight:900; color:#78350F; margin-bottom:6px; font-family:Arial,Helvetica,sans-serif;">
        DOWNPAYMENT SECURED · PENDING REVIEW
      </div>
      <div style="font-size:12px; color:#92400E; font-weight:600;">
        Reference: <strong style="font-family:monospace; font-size:13px; color:#78350F;">#${safeRef}</strong>
      </div>
    </div>

    <!-- ── Next Steps & Production Notice ── -->
    <div style="background-color:#F8FAFC; border:1px solid #E2E8F0; border-radius:10px; padding:18px 20px; margin-bottom:20px;">
      <div style="font-size:11px; font-weight:700; color:#334155; text-transform:uppercase; letter-spacing:0.8px; margin-bottom:10px;">
        📋 What Happens Next?
      </div>
      <ol style="margin:0; padding-left:18px; font-size:12px; color:#4B5563; line-height:1.7;">
        <li><strong>Venue &amp; Technical Assessment:</strong> Our production engineer is reviewing the venue power specifications, acoustic profile, and rigging safety for your date.</li>
        <li><strong>Crew &amp; Equipment Allocation:</strong> We ensure 100% attendance availability of certified audio/lighting technicians.</li>
        <li><strong>Official Confirmation:</strong> You will receive a final confirmation notification within <strong>24 hours</strong> once verified.</li>
        <li><strong>100% Refund Guarantee:</strong> In the rare event of technical constraints or venue incompatibilities, your deposit is <strong>fully refunded immediately</strong>.</li>
      </ol>
    </div>

    <!-- ── Summary Table ── -->
    <div class="code-box" style="background-color:#ECEEF1; border:1px solid #E4E6EA; border-radius:10px; padding:18px 20px; margin-bottom:20px; font-size:12px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
        <tr>
          <td style="padding:4px 0; color:#6B7280; width:35%;">Package:</td>
          <td style="padding:4px 0; text-align:right; font-weight:700; color:#24252C;">${safePkg}</td>
        </tr>
        <tr>
          <td style="padding:4px 0; color:#6B7280;">Event Date:</td>
          <td style="padding:4px 0; text-align:right; font-weight:700; color:#24252C;">${safeDate} (${safeStartTime} - ${safeEndTime})</td>
        </tr>
        <tr>
          <td style="padding:4px 0; color:#6B7280;">Venue:</td>
          <td style="padding:4px 0; text-align:right; font-weight:600; color:#24252C;">${safeVenue}</td>
        </tr>
        <tr>
          <td style="padding:4px 0; color:#6B7280;">Total Package Amount:</td>
          <td style="padding:4px 0; text-align:right; font-weight:700; color:#24252C;">₱${totalNum.toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
        </tr>
        <tr style="border-top:1px solid #E4E6EA;">
          <td style="padding:6px 0 2px 0; color:#059669; font-weight:700;">Secured Downpayment:</td>
          <td style="padding:6px 0 2px 0; text-align:right; font-weight:800; font-size:13px; color:#059669;">₱${depositNum.toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
        </tr>
      </table>
    </div>

    <!-- ── Live Tracking CTA ── -->
    <div style="text-align:center; margin:26px 0;">
      <a
        href="${trackerLink}"
        target="_blank"
        style="display:inline-block; background-color:#24252C; color:#FFFFFF; font-size:13px; font-weight:700; text-decoration:none; padding:13px 30px; border-radius:9999px; letter-spacing:0.3px;"
      >
        Track Reservation Status →
      </a>
    </div>

    <p class="text-muted" style="margin:20px 0 0 0; font-size:12px; color:#6B7280; line-height:1.6; font-family:Arial,Helvetica,sans-serif;">
      Have immediate questions regarding your event date? Reply directly to this email or reach us at <a href="mailto:admin@binhiconcept.ph" style="color:#2563EB; text-decoration:none;">admin@binhiconcept.ph</a>.
    </p>
  `;

  return renderEmailShell({
    title: `Downpayment Secured & Reservation Under Review: #${safeRef} - BINHI Concept`,
    badgeText: 'RESERVATION UNDER REVIEW',
    headline: 'Downpayment Secured · Under Technical Review',
    bodyContent,
  });
}

/**
 * 13. Template: Admin Alert - New Booking Pending Approval
 */
export function getAdminNewBookingPendingReviewAlertHtml(data: BookingConfirmationEmailData): string {
  const safeName = escapeHtml(data.customerName || 'Client');
  const safeRef = escapeHtml(data.paymongoReference || data.bookingId);
  const safePkg = escapeHtml(data.packageName || 'Production Package');
  const safeDate = escapeHtml(data.eventDate);
  const safeVenue = escapeHtml(data.venueAddress || 'Venue');
  const safeEmail = escapeHtml(data.customerEmail);
  const safePhone = data.customerPhone ? escapeHtml(data.customerPhone) : 'N/A';
  const totalNum = typeof data.totalCost === 'number' ? data.totalCost : parseFloat(String(data.totalCost).replace(/[^0-9.]/g, '')) || 0;
  const depositNum = typeof data.depositAmount === 'number' ? data.depositAmount : parseFloat(String(data.depositAmount).replace(/[^0-9.]/g, '')) || 0;

  const bodyContent = `
    <p class="text-muted" style="margin:0 0 16px 0; font-size:14px; color:#6B7280; line-height:1.65; font-family:Arial,Helvetica,sans-serif;">
      A customer has completed downpayment for an event reservation and is awaiting <strong class="text-ink" style="color:#24252C;">Technical &amp; Crew Schedule Approval</strong>.
    </p>

    <div style="background-color:#FFFBEB; border:1px solid #FDE68A; border-radius:10px; padding:16px 18px; margin-bottom:20px;">
      <div style="font-size:10px; font-weight:700; color:#B45309; text-transform:uppercase; letter-spacing:1px; margin-bottom:4px;">
        Action Required: Review &amp; Approve Booking
      </div>
      <div style="font-size:18px; font-weight:800; color:#92400E;">
        ${safeName} · #${safeRef}
      </div>
      <div style="font-size:12px; color:#78350F; margin-top:2px;">
        ${safePkg} — Target Date: <strong>${safeDate}</strong>
      </div>
    </div>

    <div class="code-box" style="background-color:#ECEEF1; border:1px solid #E4E6EA; border-radius:8px; padding:16px 18px; margin-bottom:20px; font-size:12px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
        <tr>
          <td style="padding:4px 0; color:#6B7280;">Customer:</td>
          <td style="padding:4px 0; text-align:right; font-weight:700; color:#24252C;">${safeName}</td>
        </tr>
        <tr>
          <td style="padding:4px 0; color:#6B7280;">Email:</td>
          <td style="padding:4px 0; text-align:right; font-family:monospace; color:#24252C;">${safeEmail}</td>
        </tr>
        <tr>
          <td style="padding:4px 0; color:#6B7280;">Contact:</td>
          <td style="padding:4px 0; text-align:right; color:#24252C;">${safePhone}</td>
        </tr>
        <tr>
          <td style="padding:4px 0; color:#6B7280;">Venue:</td>
          <td style="padding:4px 0; text-align:right; font-weight:600; color:#24252C;">${safeVenue}</td>
        </tr>
        <tr>
          <td style="padding:4px 0; color:#6B7280;">Total Package Cost:</td>
          <td style="padding:4px 0; text-align:right; font-weight:700; color:#24252C;">₱${totalNum.toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
        </tr>
        <tr>
          <td style="padding:4px 0; color:#6B7280;">Deposit Collected:</td>
          <td style="padding:4px 0; text-align:right; font-weight:700; color:#15803D;">₱${depositNum.toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
        </tr>
      </table>
    </div>

    <p class="text-muted" style="margin:20px 0 0 0; font-size:12px; color:#6B7280; line-height:1.6; font-family:Arial,Helvetica,sans-serif;">
      Please log in to the <strong>Admin Dashboard &rarr; Bookings Decision Center</strong> to approve or decline with full automatic refund.
    </p>
  `;

  return renderEmailShell({
    title: `[Action Required: Pending Review] #${safeRef} - ${safeName} (${safeDate})`,
    badgeText: 'PENDING APPROVAL',
    headline: 'New Booking Awaiting Technical Review',
    bodyContent,
  });
}

/**
 * 14. Template: Customer Notification - Booking Approved & Officially Confirmed
 */
export function getBookingApprovedEmailHtml(data: BookingConfirmationEmailData): string {
  return getBookingConfirmationEmailHtml(data);
}

/**
 * 15. Template: Customer Notification - Booking Declined & 100% Refund Issued
 */
export function getBookingDeclinedRefundedEmailHtml(data: BookingDeclinedEmailData): string {
  const safeName = escapeHtml(data.customerName || 'Valued Customer');
  const safeRef = escapeHtml(data.paymongoReference || data.bookingId);
  const safePkg = escapeHtml(data.packageName || 'Production Package');
  const safeDate = escapeHtml(data.eventDate);
  const safeReason = escapeHtml(data.declineReason || 'Venue technical constraints or certified technician scheduling limitations.');
  const safeNotes = data.adminNotes ? escapeHtml(data.adminNotes).replace(/\n/g, '<br/>') : '';
  const safeRefundRef = escapeHtml(data.refundReference || `REF-${Date.now().toString().slice(-6)}`);

  const depositNum = typeof data.depositAmount === 'number' ? data.depositAmount : parseFloat(String(data.depositAmount).replace(/[^0-9.]/g, '')) || 0;
  const refundNum = typeof data.refundAmount === 'number' ? data.refundAmount : parseFloat(String(data.refundAmount).replace(/[^0-9.]/g, '')) || depositNum;

  const bodyContent = `
    <p class="text-muted" style="margin:0 0 16px 0; font-size:14px; color:#6B7280; line-height:1.65; font-family:Arial,Helvetica,sans-serif;">
      Dear <strong class="text-ink" style="color:#24252C;">${safeName}</strong>,
    </p>
    <p class="text-muted" style="margin:0 0 20px 0; font-size:14px; color:#6B7280; line-height:1.65; font-family:Arial,Helvetica,sans-serif;">
      Thank you for your interest in partnering with <strong>BINHI Concept</strong> for your event on <strong>${safeDate}</strong>. Following our technical review and crew logistics assessment, we regret to inform you that we cannot accommodate your reservation for <strong>${safePkg}</strong>.
    </p>

    <!-- ── 100% Refund Processed Box ── -->
    <div style="background-color:#F0FDF4; border:1.5px solid #86EFAC; border-radius:12px; padding:18px 22px; margin-bottom:22px;">
      <div style="font-size:10px; font-weight:700; color:#15803D; letter-spacing:1px; text-transform:uppercase; margin-bottom:4px;">
        ✓ 100% Full Refund Issued
      </div>
      <div style="font-size:22px; font-weight:900; color:#166534; margin-bottom:4px;">
        ₱${refundNum.toLocaleString('en-US', { minimumFractionDigits: 2 })}
      </div>
      <div style="font-size:11px; color:#14532D;">
        Refund Reference: <strong style="font-family:monospace; color:#166534;">#${safeRefundRef}</strong>
      </div>
      <div style="font-size:11px; color:#15803D; margin-top:6px; line-height:1.5;">
        Your initial deposit has been fully reversed to your original payment channel via PayMongo. Crediting takes 1-3 business days depending on your bank or e-wallet provider.
      </div>
    </div>

    <!-- Reason Box -->
    <div style="background-color:#FEF2F2; border:1px solid #FECACA; border-radius:10px; padding:16px 18px; margin-bottom:20px; font-size:12px; color:#991B1B;">
      <strong style="font-size:11px; text-transform:uppercase; letter-spacing:0.5px; display:block; margin-bottom:4px;">Assessment Details:</strong>
      ${safeReason}
      ${safeNotes ? `<div style="margin-top:8px; padding-top:8px; border-top:1px dashed #FECACA; color:#7F1D1D;"><strong>Technician Remarks:</strong> ${safeNotes}</div>` : ''}
    </div>

    <p class="text-muted" style="margin:20px 0 0 0; font-size:12px; color:#6B7280; line-height:1.6; font-family:Arial,Helvetica,sans-serif;">
      We sincerely apologize for any inconvenience caused and hope to support your upcoming productions on future available dates. If you have questions regarding this refund, reply directly to this email or reach us at <a href="mailto:admin@binhiconcept.ph" style="color:#2563EB; text-decoration:none;">admin@binhiconcept.ph</a>.
    </p>
  `;

  return renderEmailShell({
    title: `Booking Notice: Reservation Declined & Refund Issued: #${safeRef} - BINHI Concept`,
    badgeText: 'REFUND PROCESSED',
    headline: 'Booking Reservation Update & 100% Refund',
    bodyContent,
  });
}





