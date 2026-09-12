import crypto from "node:crypto";
import QRCode from "qrcode";
import { getAuthSecret } from "../../auth/token.service.js";
import { AppError } from "../../utils/errors.js";

/**
 * Entry Pass Token Version
 */
export const ENTRY_PASS_VERSION = 1;

/**
 * Default Entry Pass Expiration: 30 days
 */
export const DEFAULT_ENTRY_PASS_TTL_SECONDS = 30 * 24 * 60 * 60;

/**
 * Signs a minimal entry pass payload with HMAC-SHA256
 * @param {Object} params
 * @param {Object} params.registration - Registration document/object
 * @param {Object|string} params.event - Event document or ID
 * @param {Object|string} params.club - Club document or ID
 * @param {number} [params.expiresInSeconds] - Optional custom TTL
 * @returns {string} Signed token: base64url(payload).base64url(hmac)
 */
export function issueEntryPassToken({ registration, event, club, expiresInSeconds = DEFAULT_ENTRY_PASS_TTL_SECONDS }) {
  if (!registration || !registration._id) {
    throw new AppError("Registration is required to issue entry pass", 400);
  }

  const nowSec = Math.floor(Date.now() / 1000);
  const regId = String(registration._id || registration.id);
  const eventId = String(event?._id || event?.id || event || registration.event?._id || registration.event);
  const clubId = String(club?._id || club?.id || club || registration.club?._id || registration.club);
  const seq = String(registration.regNo || "CONFIRMED");

  // Minimal non-sensitive payload only
  const payload = {
    v: ENTRY_PASS_VERSION,
    t: "ep", // entry pass type identifier
    rid: regId,
    eid: eventId,
    cid: clubId,
    seq,
    iat: nowSec,
    exp: nowSec + Number(expiresInSeconds),
  };

  const bodyB64 = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = crypto
    .createHmac("sha256", getAuthSecret())
    .update(`ep:${bodyB64}`)
    .digest("base64url");

  return `${bodyB64}.${signature}`;
}

/**
 * Timing-safe string comparison
 */
function timingSafeEqual(a, b) {
  const aBuf = Buffer.from(String(a));
  const bBuf = Buffer.from(String(b));
  if (aBuf.length !== bBuf.length) return false;
  return crypto.timingSafeEqual(aBuf, bBuf);
}

/**
 * Verifies and decodes an entry pass token string
 * @param {string} token - Signed entry pass token
 * @returns {{ valid: boolean, claims?: Object, error?: string }}
 */
export function verifyEntryPassToken(token) {
  if (typeof token !== "string" || !token.includes(".")) {
    return { valid: false, error: "Invalid entry pass token format" };
  }

  const [bodyB64, signature] = token.split(".");
  if (!bodyB64 || !signature) {
    return { valid: false, error: "Malformed entry pass token" };
  }

  const expectedSignature = crypto
    .createHmac("sha256", getAuthSecret())
    .update(`ep:${bodyB64}`)
    .digest("base64url");

  if (!timingSafeEqual(signature, expectedSignature)) {
    return { valid: false, error: "Invalid or forged entry pass signature" };
  }

  let claims;
  try {
    claims = JSON.parse(Buffer.from(bodyB64, "base64url").toString("utf8"));
  } catch {
    return { valid: false, error: "Malformed entry pass payload" };
  }

  if (claims.v !== ENTRY_PASS_VERSION || claims.t !== "ep") {
    return { valid: false, error: "Unsupported entry pass token version or type" };
  }

  if (!claims.rid || !claims.eid || !claims.cid) {
    return { valid: false, error: "Missing required entry pass token claims" };
  }

  const nowSec = Math.floor(Date.now() / 1000);
  if (claims.exp && claims.exp < nowSec) {
    return { valid: false, error: "Entry pass token has expired", claims };
  }

  return { valid: true, claims };
}

/**
 * Generates a high-resolution QR code Data URL (PNG base64) for a token
 * @param {string} token
 * @param {Object} [options]
 * @returns {Promise<string>}
 */
export async function generatePassQrCodeDataUrl(token, options = {}) {
  return QRCode.toDataURL(token, {
    errorCorrectionLevel: "M",
    margin: 2,
    width: options.width || 320,
    color: {
      dark: options.darkColor || "#111827",
      light: options.lightColor || "#ffffff",
    },
    ...options,
  });
}

/**
 * Generates an SVG string representation of the QR code
 * @param {string} token
 * @param {Object} [options]
 * @returns {Promise<string>}
 */
export async function generatePassQrCodeSvg(token, options = {}) {
  return QRCode.toString(token, {
    type: "svg",
    errorCorrectionLevel: "M",
    margin: 2,
    width: options.width || 320,
    ...options,
  });
}

export default {
  ENTRY_PASS_VERSION,
  DEFAULT_ENTRY_PASS_TTL_SECONDS,
  issueEntryPassToken,
  verifyEntryPassToken,
  generatePassQrCodeDataUrl,
  generatePassQrCodeSvg,
};