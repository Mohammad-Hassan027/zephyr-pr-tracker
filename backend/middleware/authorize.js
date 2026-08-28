/**
 * authorize.js
 *
 * Express middleware for role-based and resource authorization.
 * Executed after `authenticate` middleware, which populates `req.auth`.
 *
 * Preserved error formats & status codes:
 *  - requireClub:           403 { error: "Club admin access required" }
 *  - requirePlatformAdmin: 403 { error: "Platform admin access required" }
 *  - requireClubOrPRMember: 403 { error: "Access denied" }
 *  - If req.auth is missing (unauthenticated): 401 { error: "Authentication required" }
 */

import { extractBearerToken } from "../auth/session.service.js";
import { resolveIdentity } from "../auth/identity.service.js";

/**
 * Ensures req.auth exists. If missing, attempts authentication.
 * Rejects with 401 if unauthenticated.
 */
async function ensureAuth(req, res) {
  if (req.auth) return req.auth;

  const token = extractBearerToken(req);
  if (!token) {
    res.status(401).json({ error: "Authentication required" });
    return null;
  }

  try {
    req.auth = await resolveIdentity(token);
    return req.auth;
  } catch (err) {
    if (
      err.name === "MongooseError" ||
      err.name === "MongoServerError" ||
      err.name === "MongoNetworkError" ||
      err.name === "MongoDriverError" ||
      err.name === "MongoServerSelectionError"
    ) {
      res.status(503).json({ error: "Service unavailable" });
    } else {
      res.status(401).json({ error: "Authentication required" });
    }
    return null;
  }
}

/**
 * Middleware: Require Club Admin access ("club" or "admin" role).
 */
export async function requireClub(req, res, next) {
  const auth = await ensureAuth(req, res);
  if (!auth) return;

  if (auth.role !== "club" && auth.role !== "admin") {
    return res.status(403).json({ error: "Club admin access required" });
  }

  return next();
}

export const requireAdmin = requireClub;

/**
 * Middleware: Require Platform Admin access ("platform_admin" role).
 */
export async function requirePlatformAdmin(req, res, next) {
  const auth = await ensureAuth(req, res);
  if (!auth) return;

  if (auth.role !== "platform_admin") {
    return res.status(403).json({ error: "Platform admin access required" });
  }

  return next();
}

/**
 * Middleware: Require Club Admin OR PR Member access ("club", "admin", or "pr" role).
 */
export async function requireAdminOrPRMember(req, res, next) {
  const auth = await ensureAuth(req, res);
  if (!auth) return;

  if (auth.role === "club" || auth.role === "admin" || auth.role === "pr") {
    return next();
  }

  return res.status(403).json({ error: "Access denied" });
}

export const requireClubOrPRMember = requireAdminOrPRMember;
