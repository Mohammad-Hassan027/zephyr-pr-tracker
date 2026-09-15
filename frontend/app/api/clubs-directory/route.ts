import { NextResponse } from "next/server";
import { backendUrl } from "@/lib/server-auth";

export const revalidate = 60;

type ClubSummary = {
  name: string;
  slug: string;
};

type BackendEvent = {
  name: string;
  slug: string;
  date?: string | null;
  venue?: string;
  fee?: number;
  description?: string;
};

export type ClubDirectoryEntry = {
  name: string;
  slug: string;
  events: Array<{
    title: string;
    slug: string;
    date: string | null;
    venue?: string;
    fee?: number;
    description?: string;
  }>;
};

export async function GET() {
  try {
    const clubsRes = await fetch(backendUrl("/clubs"), {
      next: { revalidate: 60 },
    });
    if (!clubsRes.ok) {
      return NextResponse.json(
        { error: "Failed to load clubs" },
        { status: 502 },
      );
    }

    const clubs = (await clubsRes.json()) as ClubSummary[];
    if (!Array.isArray(clubs)) {
      return NextResponse.json(
        { error: "Invalid clubs response" },
        { status: 502 },
      );
    }

    const directory: ClubDirectoryEntry[] = await Promise.all(
      clubs.map(async (club) => {
        const eventsRes = await fetch(
          backendUrl(`/events?club=${encodeURIComponent(club.slug)}`),
          { next: { revalidate: 60 } },
        );
        const events = eventsRes.ok
          ? ((await eventsRes.json()) as BackendEvent[])
          : [];

        return {
          name: club.name,
          slug: club.slug,
          events: (Array.isArray(events) ? events : []).map((event) => ({
            title: event.name,
            slug: event.slug,
            date: event.date ?? null,
            venue: event.venue || "",
            fee: event.fee ?? 0,
            description: event.description || "",
          })),
        };
      }),
    );

    return NextResponse.json(directory);
  } catch (_err) {
    return NextResponse.json(
      { error: "Failed to load clubs directory" },
      { status: 502 },
    );
  }
}
