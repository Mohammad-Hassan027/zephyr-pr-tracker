import { apiFetch, REVALIDATE_60 } from "./client";
import type { EventItem } from "./types";

export type { EventItem };

export async function getEvents(
  clubSlug?: string,
  options?: { status?: string; includeExpired?: boolean },
): Promise<EventItem[]> {
  const params = new URLSearchParams();
  if (clubSlug) params.set("club", clubSlug);
  if (options?.status) params.set("status", options.status);
  if (options?.includeExpired !== undefined) {
    params.set("includeExpired", String(options.includeExpired));
  }
  const query = params.toString();
  const endpoint = query ? `/events?${query}` : "/events";
  return apiFetch<EventItem[]>(endpoint, REVALIDATE_60);
}
