/**
 * token.service.js
 *
 * Pure HMAC-SHA256 token primitives.
 * No Express, no Mongoose — fully unit-testable in isolation.
 *
 * Token format: base64url(JSON payload) . base64url(HMAC signature)
 */

import crypto from "node:crypto";

export const SESSION_TTL_SECONDS = 60 * 60 * 24 * 7; // 7 days

const MIN_SECRET_LENGTH = 32;
let _cachedSecret = null;

/**
 * Load, validate, and cache AUTH_SECRET from the environment.
 * Throws on startup if missing or too short.
 * @returns {string}
 */
export function getAuthSecret() {
  if (_cachedSecret) return _cachedSecret;
  const secret = process.env.AUTH_SECRET;
  if (!secret) {
    throw new Error("FATAL: AUTH_SECRET is not configured. Refusing to start.");
  }
  if (secret.length < MIN_SECRET_LENGTH) {
    throw new Error(
      `FATAL: AUTH_SECRET must be at least ${MIN_SECRET_LENGTH} characters.`,
    );
  }
  _cachedSecret = secret;
  return secret;
}

/**
 * Compute HMAC-SHA256 over a base64url-encoded payload string.
 * @param {string} bodyB64 - base64url string (the token body)
 * @returns {string} base64url signature
 */
function hmacSign(bodyB64) {
  return crypto
    .createHmac("sha256", getAuthSecret())
    .update(bodyB64)
    .digest("base64url");
}

/**
 * Timing-safe string equality. Prevents timing oracle attacks on signatures.
 * @param {string} a
 * @param {string} b
 * @returns {boolean}
 */
function timingSafeEqual(a, b) {
  const aBuf = Buffer.from(String(a));
  const bBuf = Buffer.from(String(b));
  if (aBuf.length !== bBuf.length) return false;
  return crypto.timingSafeEqual(aBuf, bBuf);
}

/**
 * Sign a payload object and return a `body.signature` token string.
 * The payload must already contain `iat` and `exp` epoch seconds.
 * @param {Record<string, unknown>} payload
 * @returns {string}
 */
export function signToken(payload) {
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = hmacSign(body);
  return `${body}.${signature}`;
}

/**
 * Verify a token string. Returns the parsed payload on success.
 * Throws if the token is malformed, signature is wrong, or the token is expired.
 * @param {string} token
 * @returns {Record<string, unknown>} parsed payload claims
 */
export function verifyToken(token) {
  const [body, signature] = String(token || "").split(".");
  if (!body || !signature) {
    throw new Error("Invalid session");
  }

  const expected = hmacSign(body);
  if (!timingSafeEqual(signature, expected)) {
    throw new Error("Invalid session");
  }

  let claims;
  try {
    claims = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
  } catch {
    throw new Error("Invalid session");
  }

  if (!claims.exp || claims.exp < Math.floor(Date.now() / 1000)) {
    throw new Error("Session expired");
  }

  return claims;
}

/**
 * Decode a token body WITHOUT signature verification.
 * Use only for non-security-sensitive inspection (e.g. logging role names).
 * Never log sensitive fields (PINs, secrets, passwords).
 * @param {string} token
 * @returns {Record<string, unknown> | null}
 */
export function decodeTokenUnchecked(token) {
  try {
    const [body] = String(token || "").split(".");
    if (!body) return null;
    return JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
  } catch {
    return null;
  }
}
