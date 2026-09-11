/**
 * Abstract Base Email Provider
 */
export class EmailProvider {
  /**
   * @param {Object} options
   */
  constructor(options = {}) {
    this.name = "base";
    this.options = options;
  }

  /**
   * Sends an email message.
   * @param {Object} message
   * @param {string|string[]} message.to - Recipient email(s)
   * @param {string} message.subject - Subject line
   * @param {string} [message.html] - HTML body
   * @param {string} [message.text] - Plain text body
   * @param {string} [message.from] - Sender address
   * @param {string} [message.replyTo] - Reply-to address
   * @param {Object} [message.metadata] - Extra metadata/tags
   * @returns {Promise<{ ok: boolean, messageId?: string, provider: string, error?: string }>}
   */
  async sendEmail(message) {
    throw new Error("sendEmail() must be implemented by concrete EmailProvider subclass");
  }

  /**
   * Verifies provider connectivity/configuration.
   * @returns {Promise<{ ok: boolean, error?: string }>}
   */
  async verifyConnection() {
    return { ok: true };
  }
}

export default EmailProvider;