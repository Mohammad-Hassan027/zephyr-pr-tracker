import type { EventStat, LeaderboardEntry } from "@/lib/api";
import {
  ADMIN_SESSION_COOKIE,
  backendUrl,
  getSessionToken,
} from "@/lib/server-auth";

async function adminFetch<T>(path: string): Promise<T> {
  const token = getSessionToken(ADMIN_SESSION_COOKIE);
  if (!token) throw new Error("Authentication required");

  const res = await fetch(backendUrl(path), {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  const data = await res.json();

  if (!res.ok) {
    throw new Error(data.error || "Admin request failed");
  }

  return data as T;
}

export function getAdminStats() {
  return adminFetch<EventStat[]>("/registrations/stats/summary");
}

export function getAdminLeaderboard() {
  return adminFetch<LeaderboardEntry[]>("/registrations/stats/leaderboard");
}
