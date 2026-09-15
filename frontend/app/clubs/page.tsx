import Header from "@/components/Header";
import { backendUrl } from "@/lib/server-auth";
import type { ClubDirectoryEntry } from "@/app/api/clubs-directory/route";
import ClubsSearch from "./ClubsSearch";

export const revalidate = 60;

type ClubSummary = {
  name: string;
  slug: string;
};

type BackendEvent = {
  name?: string;
  title?: string;
  slug: string;
  date?: string | null;
  venue?: string;
  fee?: number;
  description?: string;
};

async function getClubsDirectory(): Promise<ClubDirectoryEntry[]> {
  try {
    const clubsRes = await fetch(backendUrl("/clubs"), {
      next: { revalidate: 60 },
    });
    if (!clubsRes.ok) {
      return [];
    }

    const clubs = (await clubsRes.json()) as ClubSummary[];
    if (!Array.isArray(clubs)) {
      return [];
    }

    const directory: ClubDirectoryEntry[] = await Promise.all(
      clubs.map(async (club) => {
        try {
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
              title: event.name || event.title || "",
              slug: event.slug,
              date: event.date ?? null,
              venue: event.venue || "",
              fee: event.fee ?? 0,
              description: event.description || "",
            })),
          };
        } catch {
          return {
            name: club.name,
            slug: club.slug,
            events: [],
          };
        }
      }),
    );

    return directory;
  } catch (err) {
    console.error("Failed to load clubs directory:", err);
    return [];
  }
}

export default async function ClubsPage() {
  const clubs = await getClubsDirectory();
  const totalEvents = clubs.reduce((acc, c) => acc + (c.events?.length || 0), 0);

  return (
    <>
      <Header />
      <main className="page-shell space-y-6">
        <ClubsSearch initialClubs={clubs} totalEvents={totalEvents} />
      </main>
    </>
  );
}
