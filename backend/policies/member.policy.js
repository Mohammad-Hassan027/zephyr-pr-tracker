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

/**
 * Validates PIN strength against policy requirements:
 *  - Must be a non-empty string of numeric digits only
 *  - Minimum 4 digits, maximum 12 digits
 *  - Rejects single repeated digits (e.g. 1111, 0000)
 *  - Rejects sequential ascending/descending numbers (e.g. 1234, 4321)
 *  - Rejects obviously weak patterns (e.g. 1212, 1122)
 *
 * @param {string} pin
 * @returns {{ valid: boolean, error?: string }}
 */
export function validatePinPolicy(pin) {
  if (!pin || typeof pin !== "string") {
    return { valid: false, error: "New PIN is required" };
  }
  const trimmed = pin.trim();
  if (!trimmed) {
    return { valid: false, error: "New PIN is required" };
  }
  if (!/^\d+$/.test(trimmed)) {
    return { valid: false, error: "PIN must contain only numbers" };
  }
  if (trimmed.length < 4) {
    return { valid: false, error: "New PIN must be at least 4 digits" };
  }
  if (trimmed.length > 12) {
    return { valid: false, error: "PIN must not exceed 12 digits" };
  }

  // Rejection of single repeated digit (e.g. 1111, 000000)
  if (new Set(trimmed).size === 1) {
    return { valid: false, error: "PIN cannot consist of a single repeated digit" };
  }

  // Rejection of sequential ascending or descending numbers (e.g. 1234, 4321)
  const digits = trimmed.split("").map(Number);
  let isAsc = true;
  let isDesc = true;
  for (let i = 1; i < digits.length; i++) {
    if (digits[i] !== digits[i - 1] + 1) isAsc = false;
    if (digits[i] !== digits[i - 1] - 1) isDesc = false;
  }
  if (isAsc || isDesc) {
    return { valid: false, error: "PIN cannot be sequential numbers" };
  }

  // Blacklisted weak patterns
  const weakPatterns = ["1212", "121212", "112233", "1122", "6969", "012345", "543210"];
  if (weakPatterns.includes(trimmed)) {
    return { valid: false, error: "PIN is too weak" };
  }

  return { valid: true };
}

