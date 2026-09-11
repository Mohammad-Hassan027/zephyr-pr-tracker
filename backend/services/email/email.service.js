import { createEmailProvider } from "./providers/index.js";
import { notificationQueue } from "./notification-queue.service.js";
import * as templates from "./templates/index.js";

/**
 * Main Email Notification Service
 */
export class EmailService {
  /**
   * @param {Object} [options]
   * @param {import("./providers/email.provider.js").EmailProvider} [options.provider]
   */
  constructor(options = {}) {
    this.provider = options.provider || createEmailProvider();
    this.queue = options.queue || notificationQueue;
  }

  /**
   * Set custom provider at runtime (useful in test suites)
   * @param {import("./providers/email.provider.js").EmailProvider} provider
   */
  setProvider(provider) {
    this.provider = provider;
  }

  /**
   * Get active provider
   */
  getProvider() {
    return this.provider;
  }

  /**
   * Retrieves base frontend client URL
   */
  getClientOrigin() {
    const raw = process.env.CLIENT_ORIGIN || process.env.CLIENT_URL || "http://localhost:3000";
    return raw.split(",")[0].trim().replace(/\/+$/, "");
  }

  /**
   * Builds attendee status tracking URL
   * @param {string} registrationId
   * @returns {string}
   */
  getStatusUrl(registrationId) {
    const origin = this.getClientOrigin();
    return `${origin}/status/${registrationId}`;
  }

  /**
   * Builds admin event management URL
   * @param {string} clubSlug
   * @param {string} eventSlug
   * @returns {string}
   */
  getAdminUrl(clubSlug, eventSlug) {
    const origin = this.getClientOrigin();
    if (clubSlug && eventSlug) {
      return `${origin}/admin/${clubSlug}/events/${eventSlug}`;
    }
    return `${origin}/admin`;
  }

  /**
   * Dispatches an email via provider wrapped in async queue
   */
  async _dispatch({ to, subject, html, text, from, replyTo, entityType, entityId, eventType, status, dedupKey }) {
    if (!to || (Array.isArray(to) && to.length === 0)) {
      return {
        enqueued: false,
        reason: "missing_recipient_email",
        error: "Recipient email is missing or empty",
      };
    }

    const job = {
      entityType: entityType || "registration",
      entityId: entityId || String(to),
      eventType,
      status,
      dedupKey,
      handler: async () => {
        return this.provider.sendEmail({
          to,
          subject,
          html,
          text,
          from,
          replyTo,
          metadata: { entityId, eventType },
        });
      },
    };

    return this.queue.enqueue(job);
  }

  /**
   * 1. Registration Submitted
   */
  async sendRegistrationSubmitted(registration, event, club) {
    if (!registration?.studentEmail) {
      return { enqueued: false, reason: "missing_recipient_email" };
    }

    const statusUrl = this.getStatusUrl(registration._id || registration.id);
    const template = templates.buildRegistrationSubmittedTemplate({
      registration,
      event,
      club,
      statusUrl,
    });

    return this._dispatch({
      to: registration.studentEmail,
      subject: template.subject,
      html: template.html,
      text: template.text,
      entityType: "registration",
      entityId: String(registration._id || registration.id),
      eventType: "registration_submitted",
      status: registration.status || "pending",
    });
  }

  /**
   * 2. Payment Proof Resubmitted
   */
  async sendPaymentProofUploaded(registration, event, club) {
    if (!registration?.studentEmail) {
      return { enqueued: false, reason: "missing_recipient_email" };
    }

    const statusUrl = this.getStatusUrl(registration._id || registration.id);
    const template = templates.buildPaymentProofUploadedTemplate({
      registration,
      event,
      club,
      statusUrl,
    });

    return this._dispatch({
      to: registration.studentEmail,
      subject: template.subject,
      html: template.html,
      text: template.text,
      entityType: "registration",
      entityId: String(registration._id || registration.id),
      eventType: "payment_proof_uploaded",
      status: registration.status || "resubmitted",
      dedupKey: `registration:${registration._id || registration.id}:resubmitted:${Date.now()}`,
    });
  }

  /**
   * 3. Registration Approved
   */
  async sendRegistrationApproved(registration, event, club) {
    if (!registration?.studentEmail) {
      return { enqueued: false, reason: "missing_recipient_email" };
    }

    const statusUrl = this.getStatusUrl(registration._id || registration.id);
    const template = templates.buildRegistrationApprovedTemplate({
      registration,
      event,
      club,
      statusUrl,
    });

    return this._dispatch({
      to: registration.studentEmail,
      subject: template.subject,
      html: template.html,
      text: template.text,
      entityType: "registration",
      entityId: String(registration._id || registration.id),
      eventType: "registration_approved",
      status: "approved",
    });
  }

  /**
   * 4. Registration Rejected
   */
  async sendRegistrationRejected(registration, event, club, reason) {
    if (!registration?.studentEmail) {
      return { enqueued: false, reason: "missing_recipient_email" };
    }

    const statusUrl = this.getStatusUrl(registration._id || registration.id);
    const template = templates.buildRegistrationRejectedTemplate({
      registration,
      event,
      club,
      statusUrl,
      reason,
    });

    return this._dispatch({
      to: registration.studentEmail,
      subject: template.subject,
      html: template.html,
      text: template.text,
      entityType: "registration",
      entityId: String(registration._id || registration.id),
      eventType: "registration_rejected",
      status: "rejected",
    });
  }

  /**
   * 5. Correction Requested
   */
  async sendCorrectionRequested(registration, event, club, correctionNote) {
    if (!registration?.studentEmail) {
      return { enqueued: false, reason: "missing_recipient_email" };
    }

    const statusUrl = this.getStatusUrl(registration._id || registration.id);
    const template = templates.buildCorrectionRequestedTemplate({
      registration,
      event,
      club,
      statusUrl,
      correctionNote,
    });

    return this._dispatch({
      to: registration.studentEmail,
      subject: template.subject,
      html: template.html,
      text: template.text,
      entityType: "registration",
      entityId: String(registration._id || registration.id),
      eventType: "correction_requested",
      status: "needs_correction",
      dedupKey: `registration:${registration._id || registration.id}:needs_correction:${Date.now()}`,
    });
  }

  /**
   * 6. Event Capacity Nearly Full
   */
  async sendEventCapacityNearlyFull(event, club, capacityInfo, adminEmails = []) {
    if (!adminEmails || adminEmails.length === 0) return { enqueued: false, reason: "no_admin_recipients" };

    const adminUrl = this.getAdminUrl(club?.slug, event?.slug);
    const template = templates.buildEventCapacityNearlyFullTemplate({
      event,
      club,
      capacityInfo,
      adminUrl,
    });

    return this._dispatch({
      to: adminEmails,
      subject: template.subject,
      html: template.html,
      text: template.text,
      entityType: "event",
      entityId: String(event?._id || event?.id),
      eventType: "event_capacity_nearly_full",
      status: "warning",
    });
  }

  /**
   * 7. Event Closed / Full
   */
  async sendEventClosed(event, club, capacityInfo, adminEmails = []) {
    if (!adminEmails || adminEmails.length === 0) return { enqueued: false, reason: "no_admin_recipients" };

    const adminUrl = this.getAdminUrl(club?.slug, event?.slug);
    const template = templates.buildEventClosedTemplate({
      event,
      club,
      capacityInfo,
      adminUrl,
    });

    return this._dispatch({
      to: adminEmails,
      subject: template.subject,
      html: template.html,
      text: template.text,
      entityType: "event",
      entityId: String(event?._id || event?.id),
      eventType: "event_closed",
      status: "closed",
    });
  }

  /**
   * 8. Waitlist Promotion
   */
  async sendWaitlistPromotion(registration, event, club) {
    if (!registration?.studentEmail) {
      return { enqueued: false, reason: "missing_recipient_email" };
    }

    const statusUrl = this.getStatusUrl(registration._id || registration.id);
    const template = templates.buildWaitlistPromotionTemplate({
      registration,
      event,
      club,
      statusUrl,
    });

    return this._dispatch({
      to: registration.studentEmail,
      subject: template.subject,
      html: template.html,
      text: template.text,
      entityType: "registration",
      entityId: String(registration._id || registration.id),
      eventType: "waitlist_promotion",
      status: "promoted",
    });
  }

  /**
   * 9. QR Entry Pass Generated
   */
  async sendQrEntryPassGenerated(registration, event, club, passDetails) {
    if (!registration?.studentEmail) {
      return { enqueued: false, reason: "missing_recipient_email" };
    }

    const statusUrl = this.getStatusUrl(registration._id || registration.id);
    const template = templates.buildQrEntryPassGeneratedTemplate({
      registration,
      event,
      club,
      statusUrl,
      passDetails,
    });

    return this._dispatch({
      to: registration.studentEmail,
      subject: template.subject,
      html: template.html,
      text: template.text,
      entityType: "registration",
      entityId: String(registration._id || registration.id),
      eventType: "qr_entry_pass_generated",
      status: "pass_generated",
    });
  }

  /**
   * 10. Registration Cancelled / Refund Status
   */
  async sendRegistrationCancelledOrRefunded(registration, event, club, refundDetails) {
    if (!registration?.studentEmail) {
      return { enqueued: false, reason: "missing_recipient_email" };
    }

    const statusUrl = this.getStatusUrl(registration._id || registration.id);
    const template = templates.buildRegistrationCancelledOrRefundedTemplate({
      registration,
      event,
      club,
      statusUrl,
      refundDetails,
    });

    return this._dispatch({
      to: registration.studentEmail,
      subject: template.subject,
      html: template.html,
      text: template.text,
      entityType: "registration",
      entityId: String(registration._id || registration.id),
      eventType: "registration_cancelled",
      status: "cancelled",
    });
  }
}

export const emailService = new EmailService();
export default emailService;