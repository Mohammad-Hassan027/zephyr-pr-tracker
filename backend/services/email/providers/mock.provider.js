import { EmailProvider } from "./email.provider.js";

/**
 * Mock Email Provider for Testing
 */
export class MockProvider extends EmailProvider {
  constructor(options = {}) {
    super(options);
    this.name = "mock";
    this.sentEmails = [];
    this.shouldFail = options.shouldFail || false;
    this.failureError = options.failureError || "Mock connection refused";
  }

  async sendEmail(message) {
    if (this.shouldFail) {
      return {
        ok: false,
        provider: this.name,
        error: this.failureError,
      };
    }

    const record = {
      ...message,
      sentAt: new Date(),
      messageId: `mock-msg-${Date.now()}-${this.sentEmails.length + 1}`,
    };

    this.sentEmails.push(record);

    return {
      ok: true,
      messageId: record.messageId,
      provider: this.name,
    };
  }

  getLatestEmail() {
    return this.sentEmails[this.sentEmails.length - 1] || null;
  }

  findEmailsByRecipient(to) {
    return this.sentEmails.filter((e) => {
      if (Array.isArray(e.to)) return e.to.includes(to);
      return e.to === to;
    });
  }

  findEmailsByEvent(eventType) {
    return this.sentEmails.filter((e) => e.metadata?.eventType === eventType);
  }

  clear() {
    this.sentEmails = [];
  }

  setShouldFail(shouldFail, failureError = "Mock connection refused") {
    this.shouldFail = shouldFail;
    this.failureError = failureError;
  }

  async verifyConnection() {
    if (this.shouldFail) {
      return { ok: false, error: this.failureError };
    }
    return { ok: true };
  }
}

export default MockProvider;