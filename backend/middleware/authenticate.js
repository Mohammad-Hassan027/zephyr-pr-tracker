/**
 * authenticate.js
 *
 * Express middleware that establishes WHO the caller is.
 *
 * Exported middleware:
 *  - authenticate        — mandatory; rejects requests with no/bad token (401)
 *  - optionalAuthenticate — attaches identity when a valid token is present;
 *                           passes through unauthenticated requests for routes
 *                           that serve both public and authenticated callers
 *
 * On success, attaches req.auth:
 *   { role, clubId, clubSlug, code }
 *
 * Preserved behavior:
 *  - Unauthorized response: 401 { error: "Authentication required" }
 *  - Bearer token extraction from Authorization header (unchanged)
 *  - PR member DB lookup for `role === "pr"` tokens
 */

import { extractBearerToken } from "../auth/session.service.js";
import { resolveIdentity } from "../auth/identity.service.js";

/**
 * Mandatory authentication middleware.
 * Rejects with 401 if the token is absent, malformed, expired, or tampered.
 *
 * @type {import("express").RequestHandler}
 */
export async function authenticate(req, res, next) {
  try {
    const token = extractBearerToken(req);
    if (!token) {
      return res.status(401).json({ error: "Authentication required" });
    }

    req.auth = await resolveIdentity(token);
    return next();
  } catch {
    return res.status(401).json({ error: "Authentication required" });
  }
}

/**
 * Optional authentication middleware.
 * Attaches req.auth when a valid token is present; otherwise sets req.auth = null
 * and calls next(). Use for routes that can operate with or without authentication
 * (e.g. GET /api/members?club=slug, GET /api/events?club=slug).
 *
 * Unlike the previous inline verifySessionToken calls, this does NOT return 401
 * on missing tokens — only on malformed/expired/tampered tokens.
 *
 * @type {import("express").RequestHandler}
 */
export async function optionalAuthenticate(req, res, next) {
  const token = extractBearerToken(req);

  if (!token) {
    req.auth = null;
    return next();
  }

  try {
    req.auth = await resolveIdentity(token);
  } catch {
    // Token present but invalid — treat as unauthenticated
    req.auth = null;
  }

  return next();
}
