import { EmailProvider } from "./email.provider.js";

/**
 * Console Email Provider (Development Preview Mode)
 * Prints email notifications to console in a styled preview box.
 */
export class ConsoleProvider extends EmailProvider {
  constructor(options = {}) {
    super(options);
    this.name = "console";
    this.defaultFrom = options.from || process.env.EMAIL_FROM || "Zephyr Events <noreply@zephyr.local>";
  }

  async sendEmail({ to, subject, html, text, from, replyTo, metadata = {} }) {
    const sender = from || this.defaultFrom;
    const recipient = Array.isArray(to) ? to.join(", ") : to;
    const timestamp = new Date().toISOString();
    const previewId = `console-msg-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;

    console.log("\n" + "=".repeat(60));
    console.log(`[EMAIL PREVIEW (Dev Mode)] ${timestamp}`);
    console.log(`From:    ${sender}`);
    console.log(`To:      ${recipient}`);
    if (replyTo) console.log(`ReplyTo: ${replyTo}`);
    console.log(`Subject: ${subject}`);
    if (metadata.eventType) console.log(`Event:   ${metadata.eventType} (Ref: ${metadata.entityId || "N/A"})`);
    console.log("-".repeat(60));
    console.log(text || (html ? "[HTML Content Available]" : "[Empty Body]"));
    console.log("=".repeat(60) + "\n");

    return {
      ok: true,
      messageId: previewId,
      provider: this.name,
    };
  }

  async verifyConnection() {
    return { ok: true };
  }
}

export default ConsoleProvider;