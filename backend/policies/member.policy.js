/**
 * Policy rules for PR member operations.
 */

import { isClubAdmin, ownsClub } from "./club.policy.js";

export function isPRMember(auth) {
  if (!auth) return false;
  return auth.role === "pr";
}

export function canChangePIN(auth) {
  if (!auth) return false;
  return auth.role === "pr" && Boolean(auth.code);
}

export function canManageMember(auth, memberClubId) {
  if (!auth || !memberClubId) return false;
  return isClubAdmin(auth) && ownsClub(auth, memberClubId);
}
