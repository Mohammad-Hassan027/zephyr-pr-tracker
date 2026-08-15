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
  searchParams: { ref?: string };
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
        <div className="surface-card w-full p-8 text-center">
          <p className="pill-chip">404</p>
          <h1 className="mt-3 text-2xl font-semibold text-ink">
            Club Not Found
          </h1>
          <p className="mt-2 text-sm text-slate-500">
            The club{" "}
            <code className="font-mono text-xs">{clubSlug}</code> does not exist
            or has been removed.
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
    />
  );
}
