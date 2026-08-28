import { apiFetch, REVALIDATE_60 } from "./client";
import type { EventStat, LeaderboardEntry } from "./types";

export type { EventStat, LeaderboardEntry };

export async function getStats(): Promise<EventStat[]> {
  return apiFetch<EventStat[]>(
    "/api/admin/registrations/stats/summary",
    REVALIDATE_60
  );
}

export async function getLeaderboard(): Promise<LeaderboardEntry[]> {
  return apiFetch<LeaderboardEntry[]>(
    "/api/admin/registrations/stats/leaderboard",
    REVALIDATE_60
  );
}
