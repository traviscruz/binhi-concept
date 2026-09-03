/**
 * BINHI Concept Branded Email Templates
 * Styled to match the official BINHI Concept letterhead and design language.
 */

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
