const API_URL =
  process.env.NEXT_PUBLIC_API_URL ||
  (process.env.NODE_ENV === "production"
    ? "/api"
    : "http://localhost:5000/api");

export type EventItem = {
  _id: string;
  name: string;
  slug: string;
  description: string;
  date: string;
  capacity: number | null;
};

export type EventStat = {
  eventId: string;
  name: string;
  slug: string;
  capacity: number | null;
  count: number;
};

export type LeaderboardEntry = {
  name: string;
  code: string;
  count: number;
};

export type RegistrationStatus = {
  status: "pending" | "approved" | "rejected";
  rejectionReason: string | null;
  regNo: string | null;
  studentName: string;
  studentEmail: string;
  studentPhone?: string;
  college?: string;
  amount?: number;
  createdAt: string;
  event: { name: string; slug: string };
};

export type PendingRegistration = {
  _id: string;
  studentName: string;
  studentEmail: string;
  studentPhone?: string;
  college?: string;
  amount?: number;
  referralCode: string | null;
  paymentScreenshot: string;
  createdAt: string;
  event: { name: string; slug: string };
};

/** Shape returned by all paginated endpoints */
export type PaginatedResponse<T> = {
  items: T[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPrevPage: boolean;
  };
};

export async function getEvents(clubSlug?: string): Promise<EventItem[]> {
  const url = clubSlug
    ? `${API_URL}/events?club=${encodeURIComponent(clubSlug)}`
    : `${API_URL}/events`;
  const res = await fetch(url, { cache: "no-store" });
  return res.json();
}

export async function getStats(): Promise<EventStat[]> {
  const res = await fetch("/api/admin/registrations/stats/summary", {
    cache: "no-store",
  });
  return res.json();
}

export async function getLeaderboard(): Promise<LeaderboardEntry[]> {
  const res = await fetch("/api/admin/registrations/stats/leaderboard", {
    cache: "no-store",
  });
  return res.json();
}

type UploadSignature = {
  timestamp: number;
  signature: string;
  api_key: string;
  cloud_name: string;
  folder: string;
};

type CloudinaryUploadResponse = {
  secure_url?: string;
  public_id?: string;
  error?: { message?: string };
};

async function readJsonResponse<T>(res: Response): Promise<T> {
  return res.json().catch(() => ({} as T));
}

export async function uploadPaymentScreenshot(file: File): Promise<{
  paymentScreenshot: string;
  paymentScreenshotPublicId: string;
}> {
  const signatureRes = await fetch(`${API_URL}/registrations/upload-signature`, {
    method: "GET",
    cache: "no-store",
  });
  const signatureData = await readJsonResponse<UploadSignature & { error?: string }>(
    signatureRes,
  );

  if (!signatureRes.ok) {
    throw new Error(signatureData.error || "Could not prepare image upload");
  }

  const uploadBody = new FormData();
  uploadBody.append("file", file);
  uploadBody.append("api_key", signatureData.api_key);
  uploadBody.append("timestamp", String(signatureData.timestamp));
  uploadBody.append("signature", signatureData.signature);
  uploadBody.append("folder", signatureData.folder);

  const uploadRes = await fetch(
    `https://api.cloudinary.com/v1_1/${signatureData.cloud_name}/image/upload`,
    { method: "POST", body: uploadBody },
  );
  const uploadData = await readJsonResponse<CloudinaryUploadResponse>(uploadRes);

  if (!uploadRes.ok || !uploadData.secure_url || !uploadData.public_id) {
    throw new Error(
      uploadData.error?.message || "Payment screenshot upload failed",
    );
  }

  return {
    paymentScreenshot: uploadData.secure_url,
    paymentScreenshotPublicId: uploadData.public_id,
  };
}

// Submits registration data after the browser uploads the screenshot directly.
export async function submitRegistration(form: {
  studentName: string;
  studentEmail: string;
  studentPhone: string;
  college: string;
  amount: string;
  eventSlug: string;
  clubSlug?: string;
  referralCode: string;
  paymentScreenshot: string;
  paymentScreenshotPublicId: string;
}): Promise<{ id: string; status: string }> {
  const res = await fetch(`${API_URL}/registrations`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(form),
  });
  const data = await readJsonResponse<{ id: string; status: string; error?: string }>(
    res,
  );
  if (!res.ok) throw new Error(data.error || "Submission failed");
  return data;
}

export async function getRegistrationStatus(
  id: string,
): Promise<RegistrationStatus> {
  const res = await fetch(`${API_URL}/registrations/${id}`, {
    cache: "no-store",
  });
  if (!res.ok) throw new Error("Registration not found");
  return res.json();
}

export type PendingQueueFilters = {
  event?: string;
  college?: string;
  from?: string;
  to?: string;
  page?: number;
  limit?: number;
};

export async function getPendingQueue(
  code?: string,
  filters?: PendingQueueFilters,
): Promise<PaginatedResponse<PendingRegistration>> {
  const params = new URLSearchParams();
  if (code) params.set("code", code);
  if (filters?.event) params.set("event", filters.event);
  if (filters?.college) params.set("college", filters.college);
  if (filters?.from) params.set("from", filters.from);
  if (filters?.to) params.set("to", filters.to);
  if (filters?.page) params.set("page", String(filters.page));
  if (filters?.limit) params.set("limit", String(filters.limit));

  const queryString = params.toString() ? `?${params.toString()}` : "";
  const baseUrl = code
    ? "/api/pr/registrations/pending"
    : "/api/admin/registrations/pending";

  const res = await fetch(`${baseUrl}${queryString}`, { cache: "no-store" });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Queue load failed");
  return data;
}

export async function approveRegistration(id: string, reviewerCode?: string) {
  const url = reviewerCode
    ? `/api/pr/registrations/${id}/approve`
    : `/api/admin/registrations/${id}/approve`;
  const res = await fetch(url, { method: "PATCH" });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Approve failed");
  return data;
}

export async function rejectRegistration(
  id: string,
  reviewerCode?: string,
  reason?: string,
) {
  const url = reviewerCode
    ? `/api/pr/registrations/${id}/reject`
    : `/api/admin/registrations/${id}/reject`;
  const res = await fetch(url, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ reason }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Reject failed");
  return data;
}

export async function prLogin(code: string, password: string) {
  const res = await fetch("/api/pr-login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ code, password }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Login failed");
  return data as { name: string; code: string };
}
