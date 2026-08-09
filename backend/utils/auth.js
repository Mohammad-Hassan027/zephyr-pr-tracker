import crypto from "node:crypto";
import PRMember from "../models/PRMember.js";

const SESSION_TTL_SECONDS = 60 * 60 * 24 * 7;

function getAuthSecret() {
  const secret = process.env.AUTH_SECRET || process.env.PR_ADMIN_PASSWORD || "zephyr_club_default_secret_key";
  return secret;
}

function timingSafeEqualString(a, b) {
  const aBuffer = Buffer.from(String(a));
  const bBuffer = Buffer.from(String(b));

  if (aBuffer.length !== bBuffer.length) return false;
  return crypto.timingSafeEqual(aBuffer, bBuffer);
}

function sign(data) {
  return crypto.createHmac("sha256", getAuthSecret()).update(data).digest("base64url");
}

function getBearerToken(req) {
  const header = req.get("authorization") || "";
  const [scheme, token] = header.split(" ");
  return scheme?.toLowerCase() === "bearer" ? token : null;
}

export function createSessionToken(payload) {
  const now = Math.floor(Date.now() / 1000);
  const body = Buffer.from(
    JSON.stringify({
      ...payload,
      iat: now,
      exp: now + SESSION_TTL_SECONDS,
    }),
  ).toString("base64url");
  const signature = sign(body);

  return `${body}.${signature}`;
}

export function verifySessionToken(token) {
  const [body, signature] = String(token || "").split(".");
  if (!body || !signature) {
    throw new Error("Invalid session");
  }

  const expectedSignature = sign(body);
  if (!timingSafeEqualString(signature, expectedSignature)) {
    throw new Error("Invalid session");
  }

  const session = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
  if (!session.exp || session.exp < Math.floor(Date.now() / 1000)) {
    throw new Error("Session expired");
  }

  return session;
}

export async function requireClub(req, res, next) {
  try {
    const token = getBearerToken(req);
    const session = verifySessionToken(token);
    if (session.role !== "club" && session.role !== "admin") {
      return res.status(403).json({ error: "Club admin access required" });
    }

    req.auth = { role: "club", clubId: session.clubId, clubSlug: session.clubSlug };
    return next();
  } catch (_err) {
    return res.status(401).json({ error: "Authentication required" });
  }
}

// Alias for backwards compatibility
export const requireAdmin = requireClub;

export async function requireAdminOrPRMember(req, res, next) {
  try {
    const token = getBearerToken(req);
    const session = verifySessionToken(token);

    if (session.role === "club" || session.role === "admin") {
      req.auth = { role: "club", clubId: session.clubId, clubSlug: session.clubSlug };
      return next();
    }

    if (session.role === "pr" && session.code) {
      const member = await PRMember.findOne({ code: String(session.code).toUpperCase() });
      if (!member) {
        return res.status(401).json({ error: "Authentication required" });
      }

      req.auth = { role: "pr", code: member.code, clubId: member.club };
      return next();
    }

    return res.status(403).json({ error: "Access denied" });
  } catch (_err) {
    return res.status(401).json({ error: "Authentication required" });
  }
}

export const requireClubOrPRMember = requireAdminOrPRMember;
