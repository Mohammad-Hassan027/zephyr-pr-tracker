/**
 * identity.service.js
 *
 * Resolves a raw token string into a normalized identity object.
 * This is the only auth layer that interacts with Mongoose.
 *
 * Normalized identity shape (absent fields are null):
 * {
 *   role:      "club" | "pr" | "platform_admin"
 *   clubId:    ObjectId string | null
 *   clubSlug:  string | null
 *   code:      string | null   (PR member referral code)
 * }
 */

import PRMember from "../models/PRMember.js";
import { verifyToken } from "./token.service.js";

/**
 * Build a normalized identity from verified token claims.
 * For PR-member tokens, performs a DB lookup to confirm the member still exists.
 *
 * @param {string} token - raw Bearer token string
 * @returns {Promise<{ role: string, clubId: string|null, clubSlug: string|null, code: string|null }>}
 * @throws if the token is invalid, expired, signature-tampered, or the PR member no longer exists
 */
export async function resolveIdentity(token) {
  const claims = verifyToken(token);

  if (claims.role === "club" || claims.role === "admin") {
    return {
      role: "club",
      clubId: claims.clubId ? String(claims.clubId) : null,
      clubSlug: claims.clubSlug ? String(claims.clubSlug) : null,
      code: null,
    };
  }

  if (claims.role === "platform_admin") {
    return {
      role: "platform_admin",
      clubId: null,
      clubSlug: null,
      code: null,
    };
  }

  if (claims.role === "pr") {
    const code = claims.code ? String(claims.code).trim().toUpperCase() : null;
    if (!code) {
      throw new Error("Authentication required");
    }

    const query = { code };
    if (claims.clubId) {
      query.club = claims.clubId;
    }

    const member = await PRMember.findOne(query);

    if (!member) {
      throw new Error("Authentication required");
    }

    if (claims.clubId && String(member.club) !== String(claims.clubId)) {
      throw new Error("Authentication required");
    }

    if (member.code !== code) {
      throw new Error("Authentication required");
    }

    return {
      role: "pr",
      clubId: String(member.club),
      clubSlug: null,
      code: member.code,
    };
  }

  throw new Error("Authentication required");
}
