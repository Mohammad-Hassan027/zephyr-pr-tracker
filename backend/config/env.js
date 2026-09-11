/**
 * Centralized Startup Environment Configuration & Validation Module
 */

export function sanitizeValue(value) {
  if (!value) return "[MISSING]";
  return `[REDACTED (len=${String(value).length})]`;
}

export function validateEnv(options = {}) {
  const { isTest = process.env.NODE_ENV === "test" } = options;
  const errors = [];
  const warnings = [];

  const MONGO_URI = process.env.MONGO_URI;
  const AUTH_SECRET = process.env.AUTH_SECRET;
  const PLATFORM_ADMIN_PASSWORD = process.env.PLATFORM_ADMIN_PASSWORD;
  const CLIENT_ORIGIN = process.env.CLIENT_ORIGIN || process.env.CLIENT_URL;

  // 1. Validate MONGO_URI (Skip mandatory check in test mode if in-memory server used)
  if (!MONGO_URI) {
    if (!isTest) {
      errors.push("MONGO_URI is required but missing.");
    } else {
      warnings.push("MONGO_URI is missing; tests will rely on mock/disposable database setup.");
    }
  } else if (!/^mongodb(\+srv)?:\/\/.+/.test(MONGO_URI.trim())) {
    errors.push(`MONGO_URI has invalid format. Expected URL starting with mongodb:// or mongodb+srv://. Received: ${sanitizeValue(MONGO_URI)}`);
  }

  // 2. Validate AUTH_SECRET (Must be present and at least 32 characters long)
  if (!AUTH_SECRET) {
    errors.push("AUTH_SECRET is required but missing.");
  } else if (typeof AUTH_SECRET !== "string" || AUTH_SECRET.trim().length < 32) {
    errors.push(`AUTH_SECRET must be at least 32 characters long. Current length: ${AUTH_SECRET ? AUTH_SECRET.trim().length : 0}`);
  }

  // 3. Validate PLATFORM_ADMIN_PASSWORD (Must be present and at least 8 characters long)
  if (!PLATFORM_ADMIN_PASSWORD) {
    errors.push("PLATFORM_ADMIN_PASSWORD is required but missing.");
  } else if (typeof PLATFORM_ADMIN_PASSWORD !== "string" || PLATFORM_ADMIN_PASSWORD.trim().length < 8) {
    errors.push(`PLATFORM_ADMIN_PASSWORD must be at least 8 characters long. Current length: ${PLATFORM_ADMIN_PASSWORD ? PLATFORM_ADMIN_PASSWORD.trim().length : 0}`);
  }

  // 4. Validate CLIENT_ORIGIN / CLIENT_URL format
  if (CLIENT_ORIGIN && CLIENT_ORIGIN !== "*") {
    const origins = CLIENT_ORIGIN.split(",").map((o) => o.trim());
    for (const origin of origins) {
      if (origin !== "*") {
        try {
          const parsed = new URL(origin);
          if (!["http:", "https:"].includes(parsed.protocol)) {
            errors.push(`CLIENT_ORIGIN '${origin}' must use http or https protocol.`);
          }
        } catch {
          errors.push(`CLIENT_ORIGIN '${origin}' is not a valid URL.`);
        }
      }
    }
  }

  // 5. Optional Provider Configuration (Cloudinary)
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
  const apiKey = process.env.CLOUDINARY_API_KEY;
  const apiSecret = process.env.CLOUDINARY_API_SECRET;

  const hasAnyCloudinary = Boolean(cloudName || apiKey || apiSecret);
  const hasFullCloudinary = Boolean(cloudName && apiKey && apiSecret);

  if (hasAnyCloudinary && !hasFullCloudinary) {
    warnings.push("Cloudinary configuration is partial. CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET must all be set for uploads to work.");
  } else if (!hasFullCloudinary) {
    warnings.push("Cloudinary configuration missing. File upload signature generation will be disabled.");
  }

  // 6. Email Provider Configuration
  const emailProvider = (process.env.EMAIL_PROVIDER || (isTest ? "mock" : "console")).toLowerCase().trim();
  const validProviders = ["console", "mock", "smtp", "nodemailer"];
  if (!validProviders.includes(emailProvider)) {
    errors.push(`Invalid EMAIL_PROVIDER '${emailProvider}'. Must be one of: ${validProviders.join(", ")}`);
  }

  if (["smtp", "nodemailer"].includes(emailProvider)) {
    const smtpHost = process.env.SMTP_HOST;
    const smtpPort = process.env.SMTP_PORT;
    const smtpUser = process.env.SMTP_USER;
    const smtpPass = process.env.SMTP_PASSWORD || process.env.SMTP_PASS;

    if (!smtpHost) errors.push("SMTP_HOST is required when EMAIL_PROVIDER is smtp/nodemailer.");
    if (!smtpPort) {
      errors.push("SMTP_PORT is required when EMAIL_PROVIDER is smtp/nodemailer.");
    } else if (isNaN(Number(smtpPort)) || Number(smtpPort) <= 0 || Number(smtpPort) > 65535) {
      errors.push(`SMTP_PORT must be a valid port number (1-65535). Received: ${smtpPort}`);
    }
    if (!smtpUser) warnings.push("SMTP_USER is not set; attempting unauthenticated SMTP.");
    if (!smtpPass && smtpUser) warnings.push("SMTP_PASSWORD is not set while SMTP_USER is specified.");
  }

  if (errors.length > 0) {
    const diagnosticMessage = [
      "============================================================",
      "FATAL: Startup Environment Configuration Validation Failed!",
      "------------------------------------------------------------",
      ...errors.map((err) => `  ✖ ${err}`),
      "============================================================",
    ].join("\n");

    console.error(diagnosticMessage);
    const configErr = new Error("Environment configuration validation failed");
    configErr.errors = errors;
    configErr.diagnosticMessage = diagnosticMessage;
    throw configErr;
  }

  if (warnings.length > 0 && !isTest) {
    console.warn("Environment Configuration Warnings:\n" + warnings.map((w) => `  ! ${w}`).join("\n"));
  }

  return {
    valid: true,
    mongoUri: MONGO_URI,
    authSecret: AUTH_SECRET,
    platformAdminPassword: PLATFORM_ADMIN_PASSWORD,
    clientOrigin: CLIENT_ORIGIN || "*",
    isCloudinaryConfigured: hasFullCloudinary,
    email: {
      provider: emailProvider,
      from: process.env.EMAIL_FROM || "Zephyr Events <noreply@zephyr.local>",
      host: process.env.SMTP_HOST,
      port: process.env.SMTP_PORT ? Number(process.env.SMTP_PORT) : undefined,
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASSWORD || process.env.SMTP_PASS,
      secure: process.env.SMTP_SECURE === "true" || process.env.SMTP_PORT === "465",
    },
  };
}

export default validateEnv;
