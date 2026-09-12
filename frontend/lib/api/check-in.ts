import type {
  EntryPassData,
  CheckInVerificationResult,
  CheckInConfirmationResult,
  AttendeeLookupItem,
} from "./types";

/**
 * Fetches secure entry pass with signed QR code for an approved registration
 */
export async function getEntryPass(
  registrationId: string,
  accessToken?: string
): Promise<EntryPassData> {
  const headers: Record<string, string> = {};
  if (accessToken) {
    headers["x-registration-access-token"] = accessToken;
  }

  const res = await fetch(`/api/registrations/${registrationId}/entry-pass`, {
    headers,
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.error || errorData.message || "Failed to load entry pass");
  }

  return res.json();
}

/**
 * Gate Staff Check-In Verification & Preview
 */
export async function verifyCheckIn(payload: {
  token?: string;
  registrationId?: string;
  regNo?: string;
  eventSlug?: string;
}): Promise<CheckInVerificationResult> {
  const res = await fetch("/api/admin/check-in/verify", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    const err = new Error(errorData.error || errorData.message || "Check-in verification failed");
    (err as any).statusCode = res.status;
    (err as any).data = errorData.details || errorData.data;
    throw err;
  }

  return res.json();
}

/**
 * Gate Staff Check-In Confirmation
 */
export async function confirmCheckIn(payload: {
  token?: string;
  registrationId?: string;
  regNo?: string;
  eventSlug?: string;
  overrideDuplicate?: boolean;
  source?: "qr_scan" | "manual" | "override";
  notes?: string;
}): Promise<CheckInConfirmationResult> {
  const res = await fetch("/api/admin/check-in/confirm", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    const err = new Error(errorData.error || errorData.message || "Check-in confirmation failed");
    (err as any).statusCode = res.status;
    (err as any).data = errorData.details || errorData.data;
    throw err;
  }

  return res.json();
}

/**
 * Search approved attendees for manual fallback
 */
export async function lookupAttendees(params: {
  search: string;
  event?: string;
  limit?: number;
}): Promise<{ ok: boolean; count: number; items: AttendeeLookupItem[] }> {
  const searchParams = new URLSearchParams();
  if (params.search) searchParams.set("search", params.search);
  if (params.event) searchParams.set("event", params.event);
  if (params.limit) searchParams.set("limit", String(params.limit));

  const res = await fetch(`/api/admin/check-in/lookup?${searchParams.toString()}`);

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.error || errorData.message || "Failed to search attendees");
  }

  return res.json();
}