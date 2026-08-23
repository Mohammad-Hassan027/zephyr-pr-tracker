/**
 * Policy rules for registration review permissions and reviewer attribution.
 */

export function getReviewerCode(auth) {
  if (!auth) return "admin";
  return auth.role === "club" || auth.role === "admin" ? "admin" : auth.code;
}

export function canReviewRegistration(auth, registration) {
  if (!auth || !registration) return false;

  // If auth has a clubId, registration must match the club
  if (auth.clubId && registration.club) {
    const regClubId = registration.club._id
      ? registration.club._id.toString()
      : registration.club.toString();
    const authClubId = auth.clubId.toString();

    if (regClubId !== authClubId) {
      return false;
    }
  }

  // Club admin / platform admin can review all club registrations
  if (auth.role === "club" || auth.role === "admin") {
    return true;
  }

  // PR member can review if registration's referralCode matches the PR member's code
  if (auth.role === "pr" && auth.code) {
    return registration.referralCode === auth.code;
  }

  return false;
}
