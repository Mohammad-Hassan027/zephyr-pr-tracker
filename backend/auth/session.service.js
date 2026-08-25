/**
 * session.service.js
 *
 * HTTP-aware session helpers that bridge token primitives with Express
 * request conventions. No Mongoose — still testable without a database.
 */

import crypto from "node:crypto";
import { signToken, SESSION_TTL_SECONDS } from "./token.service.js";

/**
 * Create a signed session token from a role-specific payload.
 * Injects `iat` (issued-at) and `exp` (expiry) timestamps automatically.
 *
 * Preserved behavior:
 *  - Same 7-day TTL as the previous implementation.
 *  - Same base64url(JSON).base64url(HMAC) token format.
 *  - Same claims shape: { role, clubId?, clubSlug?, code?, iat, exp }
 *
 * @param {Record<string, unknown>} payload - role-specific claims (no iat/exp needed)
 * @returns {string} signed session token
 */
export function createSessionToken(payload) {
  const now = Math.floor(Date.now() / 1000);
  return signToken({
    iat: now,
    exp: now + SESSION_TTL_SECONDS,
    ...payload,
  });
}

/**
 * Extract a Bearer token from an Express request's Authorization header.
 * Returns null if the header is absent or uses a different scheme.
 *
 * @param {import("express").Request} req
 * @returns {string | null}
 */
export function extractBearerToken(req) {
  const header = req.get("authorization") || "";
  const [scheme, token] = header.split(" ");
  return scheme?.toLowerCase() === "bearer" ? (token ?? null) : null;
}

/**
 * Timing-safe comparison of a candidate password against the
 * PLATFORM_ADMIN_PASSWORD environment variable.
 * Returns false (not throws) if the env var is not configured.
 *
 * @param {string} password
 * @returns {boolean}
 */
export function isValidPlatformAdminPassword(password) {
  const configured = process.env.PLATFORM_ADMIN_PASSWORD;
  if (!configured) return false;

  const a = Buffer.from(String(password || ""));
  const b = Buffer.from(String(configured));
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}
