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

export async function getEvents(): Promise<EventItem[]> {
  const res = await fetch(`${API_URL}/events`, { cache: "no-store" });
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

// Submits the form as multipart/form-data (required for the file upload)
export async function submitRegistration(form: {
  studentName: string;
  studentEmail: string;
  studentPhone: string;
  college: string;
  amount: string;
  eventSlug: string;
  referralCode: string;
  screenshot: File;
}): Promise<{ id: string; status: string }> {
  const body = new FormData();
  Object.entries(form).forEach(([key, value]) => body.append(key, value));

  const res = await fetch(`${API_URL}/registrations`, { method: "POST", body });
  const data = await res.json();
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

export async function getPendingQueue(
  code?: string,
): Promise<PendingRegistration[]> {
  const url = code
    ? "/api/pr/registrations/pending"
    : "/api/admin/registrations/pending";
  const res = await fetch(url, { cache: "no-store" });
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
