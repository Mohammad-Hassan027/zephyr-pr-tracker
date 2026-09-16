import { NextResponse } from "next/server";
import { backendUrl } from "@/lib/server-auth";
import { isEventPubliclyVisible } from "@/lib/event-lifecycle";

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
  status?: string;
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
    status?: string;
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

    // Filter out known placeholder club slug 't' defensively
    const validClubs = clubs.filter((c) => c && c.slug && c.slug.toLowerCase() !== "t");

    const directory: ClubDirectoryEntry[] = await Promise.all(
      validClubs.map(async (club) => {
        const eventsRes = await fetch(
          backendUrl(`/events?club=${encodeURIComponent(club.slug)}`),
          { next: { revalidate: 60 } },
        );
        const rawEvents = eventsRes.ok
          ? ((await eventsRes.json()) as BackendEvent[])
          : [];

        const openEvents = (Array.isArray(rawEvents) ? rawEvents : []).filter((event) =>
          isEventPubliclyVisible(event),
        );

        return {
          name: club.name,
          slug: club.slug,
          events: openEvents.map((event) => ({
            title: event.name,
            slug: event.slug,
            date: event.date ?? null,
            venue: event.venue || "",
            fee: event.fee ?? 0,
            description: event.description || "",
            status: event.status || "open",
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
