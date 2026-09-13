/**
 * test-env-setup.js
 *
 * Test environment bootstrap — loaded via Node's --import flag BEFORE any
 * user module is evaluated. Sets all required environment variables to safe,
 * deterministic, test-only values so the full test suite runs hermetically
 * from a fresh clone with no local .env file.
 *
 * Rules:
 *  - Never contains real credentials or production secrets.
 *  - Does NOT overwrite variables already set by the shell environment,
 *    so CI can inject its own values without conflict.
 *  - Safe to commit — placeholder values only.
 *
 * Usage (already wired in package.json test scripts):
 *   node --import ./tests/test-env-setup.js tests/some.test.js
 */

function setDefault(key, value) {
  if (!process.env[key]) {
    process.env[key] = value;
  }
}

// ── Core ─────────────────────────────────────────────────────────────────────

// Mark runtime as test so env.js skips mandatory MONGO_URI requirement
setDefault("NODE_ENV", "test");

// AUTH_SECRET: must be at least 32 characters (enforced by token.service.js)
setDefault(
  "AUTH_SECRET",
  "zephyr-test-secret-key-do-not-use-in-production-32+",
);

// PLATFORM_ADMIN_PASSWORD: must be at least 8 characters
setDefault("PLATFORM_ADMIN_PASSWORD", "test-platform-admin-pw");

// CLIENT_ORIGIN / CLIENT_URL: must be a valid http/https URL
setDefault("CLIENT_ORIGIN", "http://localhost:3000");
setDefault("CLIENT_URL", "http://localhost:3000");

// PORT: 0 = OS picks a random free port (prevents address-in-use conflicts)
setDefault("PORT", "0");

// ── MongoDB ───────────────────────────────────────────────────────────────────
// Leave MONGO_URI unset so setup-test-db.js spins up MongoMemoryServer.
// Alternatively, set to a local URI and setup-test-db.js will try it first.

// ── Email ─────────────────────────────────────────────────────────────────────
// "mock" provider silently captures emails with no external connections.
setDefault("EMAIL_PROVIDER", "mock");
setDefault("EMAIL_FROM", "Zephyr Test <noreply@zephyr.test>");

// ── Cloudinary ───────────────────────────────────────────────────────────────
// Leave Cloudinary vars unset so upload-signature generation is disabled
// gracefully (env.js emits a warning, not an error, when all three are absent).
