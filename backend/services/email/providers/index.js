import { EmailProvider } from "./email.provider.js";
import { SmtpProvider } from "./smtp.provider.js";
import { ConsoleProvider } from "./console.provider.js";
import { MockProvider } from "./mock.provider.js";

/**
 * Creates an EmailProvider instance based on configuration
 * @param {Object} [config]
 * @returns {EmailProvider}
 */
export function createEmailProvider(config = {}) {
  const providerType = (
    config.provider ||
    process.env.EMAIL_PROVIDER ||
    (process.env.NODE_ENV === "test" ? "mock" : "console")
  ).toLowerCase().trim();

  switch (providerType) {
    case "smtp":
    case "nodemailer":
      return new SmtpProvider(config);
    case "mock":
      return new MockProvider(config);
    case "console":
    default:
      return new ConsoleProvider(config);
  }
}

export { EmailProvider, SmtpProvider, ConsoleProvider, MockProvider };