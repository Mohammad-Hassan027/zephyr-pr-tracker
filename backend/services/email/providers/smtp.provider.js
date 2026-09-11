import nodemailer from "nodemailer";
import { EmailProvider } from "./email.provider.js";

/**
 * SMTP / Nodemailer Provider Implementation
 */
export class SmtpProvider extends EmailProvider {
  /**
   * @param {Object} options
   * @param {string} options.host - SMTP server host
   * @param {number} options.port - SMTP server port
   * @param {string} [options.user] - SMTP username
   * @param {string} [options.pass] - SMTP password
   * @param {boolean} [options.secure] - Whether to use TLS/SSL
   * @param {string} [options.from] - Default sender address
   */
  constructor(options = {}) {
    super(options);
    this.name = "smtp";
    this.defaultFrom = options.from || process.env.EMAIL_FROM || "Zephyr Events <noreply@zephyr.local>";

    const transportConfig = {
      host: options.host || process.env.SMTP_HOST || "localhost",
      port: Number(options.port || process.env.SMTP_PORT || 587),
      secure: options.secure !== undefined ? Boolean(options.secure) : (process.env.SMTP_SECURE === "true" || process.env.SMTP_PORT === "465"),
    };

    const user = options.user || process.env.SMTP_USER;
    const pass = options.pass || process.env.SMTP_PASSWORD || process.env.SMTP_PASS;

    if (user && pass) {
      transportConfig.auth = { user, pass };
    }

    this.transporter = options.transporter || nodemailer.createTransport(transportConfig);
  }

  /**
   * Send email using nodemailer transporter
   */
  async sendEmail({ to, subject, html, text, from, replyTo, metadata = {} }) {
    try {
      const recipient = Array.isArray(to) ? to.join(", ") : to;
      const mailOptions = {
        from: from || this.defaultFrom,
        to: recipient,
        subject,
        html,
        text,
        replyTo,
        headers: {
          "X-Entity-Ref-ID": metadata.entityId || "",
          "X-Notification-Type": metadata.eventType || "",
        },
      };

      const info = await this.transporter.sendMail(mailOptions);
      return {
        ok: true,
        messageId: info.messageId,
        provider: this.name,
        response: info.response,
      };
    } catch (err) {
      return {
        ok: false,
        provider: this.name,
        error: err.message,
      };
    }
  }

  /**
   * Verify SMTP connection
   */
  async verifyConnection() {
    try {
      await this.transporter.verify();
      return { ok: true };
    } catch (err) {
      return { ok: false, error: err.message };
    }
  }
}

export default SmtpProvider;