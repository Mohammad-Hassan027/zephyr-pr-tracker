import type { EventStat, LeaderboardEntry } from "@/lib/api";
import { redirect } from "next/navigation";
import {
  ADMIN_SESSION_COOKIE,
  backendUrl,
  getSessionToken,
} from "@/lib/server-auth";

async function adminFetch<T>(path: string): Promise<T> {
  const token = await getSessionToken(ADMIN_SESSION_COOKIE);
  if (!token) {
    redirect("/login");
  }

  const res = await fetch(backendUrl(path), {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });

  if (res.status === 401) {
    redirect("/login");
  }

  const data = await res.json();

  if (!res.ok) {
    throw new Error(data.error || "Admin request failed");
  }

  return data as T;
}

export type AuditRegistration = {
  _id: string;
  regNo: string | null;
  studentName: string;
  event: { name: string; slug?: string };
  status: "approved" | "rejected";
  reviewedBy: string | null;
  rejectionReason: string | null;
  updatedAt: string;
};

export function getAdminStats() {
  return adminFetch<EventStat[]>("/registrations/stats/summary");
}

export function getAdminLeaderboard() {
  return adminFetch<LeaderboardEntry[]>("/registrations/stats/leaderboard");
}

export function getAdminAuditTrail() {
  return adminFetch<AuditRegistration[]>("/registrations/audit");
}
