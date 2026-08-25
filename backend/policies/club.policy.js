/**
 * Policy rules for club management and tenant scoping.
 */

export function isClubAdmin(auth) {
  if (!auth) return false;
  return auth.role === "club" || auth.role === "admin";
}

export function isPlatformAdmin(auth) {
  if (!auth) return false;
  return auth.role === "platform_admin";
}

export function ownsClub(auth, targetClubId) {
  if (!auth || !targetClubId || !auth.clubId) return false;
  return auth.clubId.toString() === targetClubId.toString();
}

export function canManageClub(auth, targetClubId) {
  if (isPlatformAdmin(auth)) return true;
  return isClubAdmin(auth) && ownsClub(auth, targetClubId);
}
