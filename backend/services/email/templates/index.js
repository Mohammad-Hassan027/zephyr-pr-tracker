import { renderEmailTemplate, htmlToPlainText } from "./base.template.js";

/**
 * Format currency amount
 */
function formatAmount(amount) {
  if (amount === undefined || amount === null) return "Free";
  const num = Number(amount);
  if (num === 0) return "Free";
  return `₹${num.toLocaleString("en-IN")}`;
}

/**
 * 1. Registration Submitted (Initial submission awaiting payment review)
 */
export function buildRegistrationSubmittedTemplate({ registration, event, club, statusUrl }) {
  const clubName = club?.name || "Event Organizers";
  const eventName = event?.name || "Event";
  const title = `Registration Received for ${eventName}`;

  const contentHtml = `
    <p>Hi <strong>${registration.studentName || "Participant"}</strong>,</p>
    <p>Thank you for registering for <strong>${eventName}</strong> organized by <strong>${clubName}</strong>. We have received your submission and payment proof.</p>
    
    <div style="background-color: #f9fafb; border: 1px solid #e5e7eb; border-radius: 6px; padding: 16px; margin: 20px 0;">
      <h3 style="margin: 0 0 12px 0; font-size: 14px; text-transform: uppercase; color: #4b5563;">Registration Details</h3>
      <table role="presentation" border="0" cellpadding="4" cellspacing="0" width="100%" style="font-size: 14px;">
        <tr><td style="color: #6b7280; width: 35%;">Registration ID:</td><td style="font-weight: 600; font-family: monospace;">${registration._id || registration.id}</td></tr>
        <tr><td style="color: #6b7280;">Event:</td><td style="font-weight: 500;">${eventName}</td></tr>
        <tr><td style="color: #6b7280;">Club:</td><td style="font-weight: 500;">${clubName}</td></tr>
        <tr><td style="color: #6b7280;">Amount Paid:</td><td style="font-weight: 500;">${formatAmount(registration.amount)}</td></tr>
        ${registration.utr ? `<tr><td style="color: #6b7280;">UTR / Ref:</td><td style="font-weight: 500;">${registration.utr}</td></tr>` : ""}
        <tr><td style="color: #6b7280;">Current Status:</td><td><strong style="color: #4f46e5;">Pending Verification</strong></td></tr>
      </table>
    </div>

    <p>Our team is currently reviewing your payment details. You will receive another notification once your registration is verified and approved.</p>
    <p>You can check the real-time status of your registration anytime using the link below.</p>
  `;

  const html = renderEmailTemplate({
    title,
    contentHtml,
    statusBadge: "Pending Verification",
    statusType: "pending",
    actionUrl: statusUrl,
    actionText: "View Registration Status",
    clubName,
    eventName,
  });

  return {
    subject: `[${clubName}] Registration Received: ${eventName}`,
    html,
    text: htmlToPlainText(html),
  };
}

/**
 * 2. Payment Proof Uploaded / Resubmitted
 */
export function buildPaymentProofUploadedTemplate({ registration, event, club, statusUrl }) {
  const clubName = club?.name || "Event Organizers";
  const eventName = event?.name || "Event";
  const title = `Payment Proof Resubmitted for ${eventName}`;

  const contentHtml = `
    <p>Hi <strong>${registration.studentName || "Participant"}</strong>,</p>
    <p>We received your updated payment details for <strong>${eventName}</strong>. Your registration is back in the review queue.</p>
    
    <div style="background-color: #f9fafb; border: 1px solid #e5e7eb; border-radius: 6px; padding: 16px; margin: 20px 0;">
      <h3 style="margin: 0 0 12px 0; font-size: 14px; text-transform: uppercase; color: #4b5563;">Updated Submission Details</h3>
      <table role="presentation" border="0" cellpadding="4" cellspacing="0" width="100%" style="font-size: 14px;">
        <tr><td style="color: #6b7280; width: 35%;">Registration ID:</td><td style="font-weight: 600; font-family: monospace;">${registration._id || registration.id}</td></tr>
        <tr><td style="color: #6b7280;">Event:</td><td style="font-weight: 500;">${eventName}</td></tr>
        ${registration.utr ? `<tr><td style="color: #6b7280;">Updated UTR:</td><td style="font-weight: 500;">${registration.utr}</td></tr>` : ""}
        <tr><td style="color: #6b7280;">Current Status:</td><td><strong style="color: #4f46e5;">Under Review (Resubmitted)</strong></td></tr>
      </table>
    </div>

    <p>We will notify you as soon as the reviewer finishes checking your updated submission.</p>
  `;

  const html = renderEmailTemplate({
    title,
    contentHtml,
    statusBadge: "Resubmitted",
    statusType: "resubmitted",
    actionUrl: statusUrl,
    actionText: "Track Status",
    clubName,
    eventName,
  });

  return {
    subject: `[${clubName}] Payment Proof Resubmitted: ${eventName}`,
    html,
    text: htmlToPlainText(html),
  };
}

/**
 * 3. Registration Approved
 */
export function buildRegistrationApprovedTemplate({ registration, event, club, statusUrl }) {
  const clubName = club?.name || "Event Organizers";
  const eventName = event?.name || "Event";
  const regNo = registration.regNo || "CONFIRMED";
  const title = `Registration Confirmed! 🎉`;

  const contentHtml = `
    <p>Hi <strong>${registration.studentName || "Participant"}</strong>,</p>
    <p>Great news! Your registration and payment for <strong>${eventName}</strong> have been <strong>approved</strong> by ${clubName}.</p>
    
    <div style="background-color: #ecfdf5; border: 1px solid #a7f3d0; border-radius: 6px; padding: 20px; margin: 24px 0; text-align: center;">
      <div style="font-size: 13px; text-transform: uppercase; letter-spacing: 0.05em; color: #065f46; font-weight: 600;">Your Official Registration Number</div>
      <div style="font-size: 28px; font-weight: 800; color: #047857; margin: 8px 0; font-family: monospace; letter-spacing: 0.1em;">${regNo}</div>
      <div style="font-size: 12px; color: #065f46;">Please save this number for event check-in and entry.</div>
    </div>

    <div style="background-color: #f9fafb; border: 1px solid #e5e7eb; border-radius: 6px; padding: 16px; margin: 20px 0;">
      <h3 style="margin: 0 0 12px 0; font-size: 14px; text-transform: uppercase; color: #4b5563;">Event Pass Summary</h3>
      <table role="presentation" border="0" cellpadding="4" cellspacing="0" width="100%" style="font-size: 14px;">
        <tr><td style="color: #6b7280; width: 35%;">Attendee:</td><td style="font-weight: 600;">${registration.studentName}</td></tr>
        <tr><td style="color: #6b7280;">College:</td><td style="font-weight: 500;">${registration.college || "N/A"}</td></tr>
        <tr><td style="color: #6b7280;">Event:</td><td style="font-weight: 500;">${eventName}</td></tr>
        <tr><td style="color: #6b7280;">Club / Host:</td><td style="font-weight: 500;">${clubName}</td></tr>
        ${event?.venue ? `<tr><td style="color: #6b7280;">Venue:</td><td style="font-weight: 500;">${event.venue}</td></tr>` : ""}
        ${event?.date ? `<tr><td style="color: #6b7280;">Date & Time:</td><td style="font-weight: 500;">${new Date(event.date).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}</td></tr>` : ""}
      </table>
    </div>

    <p>You can access your verified registration entry pass and QR code anytime on your status page.</p>
  `;

  const html = renderEmailTemplate({
    title,
    contentHtml,
    statusBadge: "Approved",
    statusType: "approved",
    actionUrl: statusUrl,
    actionText: "View Official Pass",
    clubName,
    eventName,
  });

  return {
    subject: `[${clubName}] Confirmed: Your Registration for ${eventName} (${regNo})`,
    html,
    text: htmlToPlainText(html),
  };
}

/**
 * 4. Registration Rejected
 */
export function buildRegistrationRejectedTemplate({ registration, event, club, statusUrl, reason }) {
  const clubName = club?.name || "Event Organizers";
  const eventName = event?.name || "Event";
  const rejectionReason = reason || registration.rejectionReason || "Payment verification could not be completed.";
  const title = `Registration Update for ${eventName}`;

  const contentHtml = `
    <p>Hi <strong>${registration.studentName || "Participant"}</strong>,</p>
    <p>We are writing to let you know that your registration for <strong>${eventName}</strong> could not be approved by <strong>${clubName}</strong>.</p>
    
    <div style="background-color: #fef2f2; border: 1px solid #fecaca; border-radius: 6px; padding: 16px; margin: 20px 0;">
      <h3 style="margin: 0 0 8px 0; font-size: 14px; text-transform: uppercase; color: #991b1b;">Reason for Rejection</h3>
      <p style="margin: 0; color: #7f1d1d; font-size: 14px; line-height: 1.5;">${rejectionReason}</p>
    </div>

    <p>If you believe this was an error or if you have questions regarding payment reconciliation, please reach out to the event organizers.</p>
  `;

  const html = renderEmailTemplate({
    title,
    contentHtml,
    statusBadge: "Rejected",
    statusType: "rejected",
    actionUrl: statusUrl,
    actionText: "Check Registration Record",
    clubName,
    eventName,
  });

  return {
    subject: `[${clubName}] Registration Update: ${eventName}`,
    html,
    text: htmlToPlainText(html),
  };
}

/**
 * 5. Correction Requested
 */
export function buildCorrectionRequestedTemplate({ registration, event, club, statusUrl, correctionNote }) {
  const clubName = club?.name || "Event Organizers";
  const eventName = event?.name || "Event";
  const note = correctionNote || registration.correctionNote || "Please update your payment screenshot or UTR number.";
  const title = `Action Required: Correction Needed for ${eventName}`;

  const contentHtml = `
    <p>Hi <strong>${registration.studentName || "Participant"}</strong>,</p>
    <p>The organizers of <strong>${eventName}</strong> have reviewed your registration and requested a correction before your registration can be approved.</p>
    
    <div style="background-color: #fffbeb; border: 1px solid #fde68a; border-radius: 6px; padding: 16px; margin: 20px 0;">
      <h3 style="margin: 0 0 8px 0; font-size: 14px; text-transform: uppercase; color: #92400e;">Note from Reviewer</h3>
      <p style="margin: 0; color: #78350f; font-size: 14px; font-weight: 500; line-height: 1.5;">${note}</p>
    </div>

    <p>Please visit your registration status page below to update your details and resubmit your payment proof.</p>
  `;

  const html = renderEmailTemplate({
    title,
    contentHtml,
    statusBadge: "Needs Correction",
    statusType: "needs_correction",
    actionUrl: statusUrl,
    actionText: "Update & Resubmit Registration",
    clubName,
    eventName,
  });

  return {
    subject: `[${clubName}] Action Required: Fix details for ${eventName}`,
    html,
    text: htmlToPlainText(html),
  };
}

/**
 * 6. Event Capacity Nearly Full (Alert for Admin/Managers)
 */
export function buildEventCapacityNearlyFullTemplate({ event, club, capacityInfo, adminUrl }) {
  const clubName = club?.name || "Event Organizers";
  const eventName = event?.name || "Event";
  const approved = capacityInfo?.approvedCount ?? event?.approvedCount ?? 0;
  const capacity = capacityInfo?.capacity ?? event?.capacity ?? 0;
  const remaining = capacityInfo?.remaining ?? Math.max(0, capacity - approved);
  const percentage = capacity > 0 ? Math.round((approved / capacity) * 100) : 100;
  const title = `⚠️ Capacity Alert: ${eventName} is at ${percentage}% Capacity`;

  const contentHtml = `
    <p>Attention Organizer,</p>
    <p>The event <strong>${eventName}</strong> under <strong>${clubName}</strong> is approaching full capacity.</p>
    
    <div style="background-color: #fffbeb; border: 1px solid #fde68a; border-radius: 6px; padding: 16px; margin: 20px 0;">
      <h3 style="margin: 0 0 12px 0; font-size: 14px; text-transform: uppercase; color: #92400e;">Current Capacity Status</h3>
      <table role="presentation" border="0" cellpadding="4" cellspacing="0" width="100%" style="font-size: 14px;">
        <tr><td style="color: #6b7280; width: 40%;">Approved Attendees:</td><td style="font-weight: 700; color: #92400e;">${approved} / ${capacity}</td></tr>
        <tr><td style="color: #6b7280;">Spots Remaining:</td><td style="font-weight: 700; color: #b45309;">${remaining}</td></tr>
        <tr><td style="color: #6b7280;">Capacity Filled:</td><td style="font-weight: 700;">${percentage}%</td></tr>
      </table>
    </div>

    <p>Please log in to your admin dashboard to monitor incoming registrations and capacity settings.</p>
  `;

  const html = renderEmailTemplate({
    title,
    contentHtml,
    statusBadge: "Capacity Alert",
    statusType: "warning",
    actionUrl: adminUrl,
    actionText: "Open Admin Dashboard",
    clubName,
    eventName,
  });

  return {
    subject: `[${clubName}] Capacity Warning: ${eventName} (${percentage}% Full)`,
    html,
    text: htmlToPlainText(html),
  };
}

/**
 * 7. Event Closed / Full
 */
export function buildEventClosedTemplate({ event, club, capacityInfo, adminUrl }) {
  const clubName = club?.name || "Event Organizers";
  const eventName = event?.name || "Event";
  const capacity = capacityInfo?.capacity ?? event?.capacity ?? 0;
  const title = `Event Sold Out: ${eventName}`;

  const contentHtml = `
    <p>Attention Organizer,</p>
    <p>The event <strong>${eventName}</strong> under <strong>${clubName}</strong> has reached its maximum capacity limit of <strong>${capacity}</strong> attendees and is now closed to new registrations.</p>
    
    <div style="background-color: #fef2f2; border: 1px solid #fecaca; border-radius: 6px; padding: 16px; margin: 20px 0;">
      <h3 style="margin: 0 0 8px 0; font-size: 14px; text-transform: uppercase; color: #991b1b;">Event Status: Full / Closed</h3>
      <p style="margin: 0; color: #7f1d1d; font-size: 14px;">Total verified attendees: <strong>${capacity}</strong></p>
    </div>

    <p>New submissions will be blocked unless event capacity is increased in the dashboard.</p>
  `;

  const html = renderEmailTemplate({
    title,
    contentHtml,
    statusBadge: "Event Closed",
    statusType: "rejected",
    actionUrl: adminUrl,
    actionText: "Manage Event",
    clubName,
    eventName,
  });

  return {
    subject: `[${clubName}] Capacity Reached: ${eventName} is now Full`,
    html,
    text: htmlToPlainText(html),
  };
}

/**
 * 8. Waitlist Promotion
 */
export function buildWaitlistPromotionTemplate({ registration, event, club, statusUrl }) {
  const clubName = club?.name || "Event Organizers";
  const eventName = event?.name || "Event";
  const title = `Good News: A Spot Opened Up for ${eventName}!`;

  const contentHtml = `
    <p>Hi <strong>${registration.studentName || "Participant"}</strong>,</p>
    <p>A slot has opened up for <strong>${eventName}</strong> organized by <strong>${clubName}</strong>, and you have been promoted from the waitlist!</p>
    
    <p>Please check your registration status page to confirm your entry.</p>
  `;

  const html = renderEmailTemplate({
    title,
    contentHtml,
    statusBadge: "Waitlist Promoted",
    statusType: "approved",
    actionUrl: statusUrl,
    actionText: "Claim Your Spot",
    clubName,
    eventName,
  });

  return {
    subject: `[${clubName}] You're Off the Waitlist for ${eventName}!`,
    html,
    text: htmlToPlainText(html),
  };
}

/**
 * 9. QR Entry Pass Generated
 */
export function buildQrEntryPassGeneratedTemplate({ registration, event, club, statusUrl }) {
  const clubName = club?.name || "Event Organizers";
  const eventName = event?.name || "Event";
  const regNo = registration.regNo || "ENTRY-PASS";
  const title = `Your Entry Pass for ${eventName}`;

  const contentHtml = `
    <p>Hi <strong>${registration.studentName || "Participant"}</strong>,</p>
    <p>Your QR entry pass for <strong>${eventName}</strong> is ready. Please present this pass or your Registration ID at the check-in desk.</p>
    
    <div style="background-color: #f9fafb; border: 1px solid #e5e7eb; border-radius: 6px; padding: 20px; margin: 20px 0; text-align: center;">
      <div style="font-size: 13px; text-transform: uppercase; color: #6b7280; font-weight: 600;">Registration ID</div>
      <div style="font-size: 24px; font-weight: 800; color: #111827; margin: 8px 0; font-family: monospace;">${regNo}</div>
      <p style="font-size: 13px; color: #4b5563; margin: 0;">Click the button below to view your digital pass and QR code on your phone.</p>
    </div>
  `;

  const html = renderEmailTemplate({
    title,
    contentHtml,
    statusBadge: "Entry Pass",
    statusType: "approved",
    actionUrl: statusUrl,
    actionText: "View Digital QR Pass",
    clubName,
    eventName,
  });

  return {
    subject: `[${clubName}] Your Entry Pass for ${eventName} (${regNo})`,
    html,
    text: htmlToPlainText(html),
  };
}

/**
 * 10. Registration Cancelled / Refund Status
 */
export function buildRegistrationCancelledOrRefundedTemplate({ registration, event, club, statusUrl, refundDetails }) {
  const clubName = club?.name || "Event Organizers";
  const eventName = event?.name || "Event";
  const title = `Registration Cancellation & Refund Notice`;

  const contentHtml = `
    <p>Hi <strong>${registration.studentName || "Participant"}</strong>,</p>
    <p>This email confirms that your registration for <strong>${eventName}</strong> has been cancelled.</p>
    
    ${refundDetails ? `
    <div style="background-color: #f9fafb; border: 1px solid #e5e7eb; border-radius: 6px; padding: 16px; margin: 20px 0;">
      <h3 style="margin: 0 0 8px 0; font-size: 14px; text-transform: uppercase; color: #4b5563;">Refund Details</h3>
      <p style="margin: 0; font-size: 14px; color: #374151;">${refundDetails}</p>
    </div>
    ` : ""}

    <p>If you have any questions, please contact the organizers at ${clubName}.</p>
  `;

  const html = renderEmailTemplate({
    title,
    contentHtml,
    statusBadge: "Cancelled",
    statusType: "rejected",
    actionUrl: statusUrl,
    actionText: "View Status Details",
    clubName,
    eventName,
  });

  return {
    subject: `[${clubName}] Cancellation Notice: ${eventName}`,
    html,
    text: htmlToPlainText(html),
  };
}

export default {
  buildRegistrationSubmittedTemplate,
  buildPaymentProofUploadedTemplate,
  buildRegistrationApprovedTemplate,
  buildRegistrationRejectedTemplate,
  buildCorrectionRequestedTemplate,
  buildEventCapacityNearlyFullTemplate,
  buildEventClosedTemplate,
  buildWaitlistPromotionTemplate,
  buildQrEntryPassGeneratedTemplate,
  buildRegistrationCancelledOrRefundedTemplate,
};