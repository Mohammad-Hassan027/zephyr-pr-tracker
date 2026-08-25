/**
 * Compatibility shim for backwards compatibility.
 * Delegates token operations to auth/* services and middleware to middleware/authorize.js.
 */

export { getAuthSecret, verifyToken as verifySessionToken } from "../auth/token.service.js";
export { createSessionToken, isValidPlatformAdminPassword } from "../auth/session.service.js";
export {
  requireClub,
  requireAdmin,
  requireAdminOrPRMember,
  requireClubOrPRMember,
  requirePlatformAdmin,
} from "../middleware/authorize.js";
