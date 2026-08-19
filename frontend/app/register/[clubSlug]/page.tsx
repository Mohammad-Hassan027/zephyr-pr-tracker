import { backendUrl } from "@/lib/server-auth";
import type { EventItem } from "@/lib/api";
import RegisterForm from "./RegisterForm";

type ClubDetails = {
  name: string;
  slug: string;
};

export default async function ClubRegisterPage({
  params,
  searchParams,
}: {
  params: { clubSlug: string };
  searchParams: { ref?: string; event?: string; email?: string; name?: string };
}) {
  const clubSlug = params.clubSlug;

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
          <h1 className="text-lg font-bold text-zinc-900">
            Club Not Found
          </h1>
          <p className="text-xs text-zinc-500">
            The club <code className="font-mono bg-zinc-100 px-1 py-0.5 rounded text-zinc-800">{clubSlug}</code> does not exist or is not approved yet.
          </p>
        </div>
      </main>
    );
  }

  const club = (await clubRes.json()) as ClubDetails;
  const eventsData = eventsRes.ok ? await eventsRes.json() : [];
  const events = (Array.isArray(eventsData) ? eventsData : []) as EventItem[];

  return (
    <RegisterForm
      club={club}
      events={events}
      clubSlug={clubSlug}
      initialReferralCode={searchParams.ref || ""}
      initialEventSlug={searchParams.event || ""}
      initialEmail={searchParams.email || ""}
      initialName={searchParams.name || ""}
    />
  );
}
