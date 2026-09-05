"use client";

const TOKEN_STORAGE_PREFIX = "zephyr_reg_token_";

export function saveRegistrationToken(registrationId: string, token: string): void {
  if (typeof window === "undefined" || !registrationId || !token) return;
  try {
    localStorage.setItem(`${TOKEN_STORAGE_PREFIX}${registrationId}`, token);
  } catch (err) {
    console.warn("Failed to store registration token in localStorage:", err);
  }
}

export function getStoredRegistrationToken(registrationId: string): string | null {
  if (typeof window === "undefined" || !registrationId) return null;
  try {
    return localStorage.getItem(`${TOKEN_STORAGE_PREFIX}${registrationId}`);
  } catch {
    return null;
  }
}

export function getRegistrationTokenFromUrl(): string | null {
  if (typeof window === "undefined") return null;

  // Check URL hash first (#token=...)
  const hash = window.location.hash;
  if (hash) {
    const hashParams = new URLSearchParams(hash.replace(/^#/, ""));
    const tokenFromHash = hashParams.get("token");
    if (tokenFromHash) return tokenFromHash;
  }

  // Fallback to search query (?token=...)
  const searchParams = new URLSearchParams(window.location.search);
  return searchParams.get("token");
}

export function resolveRegistrationToken(registrationId: string): string | null {
  const urlToken = getRegistrationTokenFromUrl();
  if (urlToken) {
    saveRegistrationToken(registrationId, urlToken);
    return urlToken;
  }
  return getStoredRegistrationToken(registrationId);
}
