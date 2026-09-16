import Link from "next/link";
import { backendUrl } from "@/lib/server-auth";
import type { EventItem } from "@/lib/api";
import RegisterForm from "./RegisterForm";

import { isEventPubliclyVisible } from "@/lib/event-lifecycle";

export const revalidate = 60;

type ClubDetails = {
  name: string;
  slug: string;
};

export default async function ClubRegisterPage({
  params,
  searchParams,
}: {
  params: Promise<{ clubSlug: string }>;
  searchParams: Promise<{
    ref?: string;
    event?: string;
    email?: string;
    name?: string;
  }>;
}) {
  const [{ clubSlug }, query] = await Promise.all([params, searchParams]);

  try {
    const [clubRes, eventsRes] = await Promise.all([
      fetch(backendUrl(`/clubs/public/${encodeURIComponent(clubSlug)}`), {
        next: { revalidate: 60 },
      }),
      fetch(backendUrl(`/events?club=${encodeURIComponent(clubSlug)}`), {
        next: { revalidate: 60 },
      }),
    ]);

    if (!clubRes.ok) {
      return (
        <main className="mx-auto flex min-h-screen max-w-md items-center justify-center p-4 sm:p-6">
          <div className="surface-card w-full p-8 text-center space-y-3">
            <span className="pill-chip">404</span>
            <h1 className="text-lg font-bold text-zinc-900">Club Not Found</h1>
            <p className="text-xs text-zinc-500">
              The club{" "}
              <code className="font-mono bg-zinc-100 px-1 py-0.5 rounded text-zinc-800">
                {clubSlug}
              </code>{" "}
              does not exist or is not approved yet.
            </p>
            <div className="pt-3">
              <Link href="/clubs" className="btn-secondary text-xs px-4 py-2">
                Browse Active Clubs →
              </Link>
            </div>
          </div>
        </main>
      );
    }

    const club = (await clubRes.json()) as ClubDetails;
    const eventsData = eventsRes.ok ? await eventsRes.json() : [];
    const allEvents = (Array.isArray(eventsData) ? eventsData : []) as EventItem[];
    const events = allEvents.filter((ev) => isEventPubliclyVisible(ev));

    return (
      <RegisterForm
        club={club}
        events={events}
        clubSlug={clubSlug}
        initialReferralCode={query.ref || ""}
        initialEventSlug={query.event || ""}
        initialEmail={query.email || ""}
        initialName={query.name || ""}
      />
    );
  } catch (err) {
    console.error("Failed to load club registration data:", err);
    return (
      <main className="mx-auto flex min-h-screen max-w-md items-center justify-center p-4 sm:p-6">
        <div className="surface-card w-full p-8 text-center space-y-3">
          <span className="pill-chip">Service Unavailable</span>
          <h1 className="text-lg font-bold text-zinc-900">Registration Temporarily Unavailable</h1>
          <p className="text-xs text-zinc-500">
            Could not retrieve registration details for{" "}
            <code className="font-mono bg-zinc-100 px-1 py-0.5 rounded text-zinc-800">
              {clubSlug}
            </code>
            . Please check your connection or try again shortly.
          </p>
          <div className="pt-3 flex flex-col sm:flex-row gap-2 justify-center">
            <Link href={`/register/${encodeURIComponent(clubSlug)}`} className="btn-primary text-xs px-4 py-2">
              Retry
            </Link>
            <Link href="/clubs" className="btn-secondary text-xs px-4 py-2">
              Browse All Clubs
            </Link>
          </div>
        </div>
      </main>
    );
  }
}
