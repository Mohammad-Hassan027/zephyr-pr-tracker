import { apiFetch, REVALIDATE_60 } from "./client";
import type { EventItem } from "./types";

export type { EventItem };

export async function getEvents(clubSlug?: string): Promise<EventItem[]> {
  const endpoint = clubSlug
    ? `/events?club=${encodeURIComponent(clubSlug)}`
    : "/events";
  return apiFetch<EventItem[]>(endpoint, REVALIDATE_60);
}
