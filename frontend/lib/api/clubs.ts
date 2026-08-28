import { apiFetch } from "./client";
import type { PublicClub } from "./types";

export type { PublicClub };

export async function getPublicClubs(): Promise<PublicClub[]> {
  return apiFetch<PublicClub[]>("/clubs");
}

export async function getPublicClubBySlug(
  slug: string
): Promise<PublicClub> {
  return apiFetch<PublicClub>(`/clubs/public/${encodeURIComponent(slug)}`);
}
