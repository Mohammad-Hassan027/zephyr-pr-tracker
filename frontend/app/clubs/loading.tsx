export default function ClubsLoading() {
  return (
    <main className="page-shell space-y-6">
      {/* Header skeleton */}
      <section className="surface-card p-5 sm:p-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="min-w-0 space-y-2">
            <div className="flex items-center gap-2">
              <div className="h-5 w-16 rounded-full bg-zinc-200 animate-pulse" />
              <div className="h-4 w-32 rounded bg-zinc-100 animate-pulse" />
            </div>
            <div className="h-7 w-48 rounded bg-zinc-200 animate-pulse" />
            <div className="h-4 w-72 rounded bg-zinc-100 animate-pulse" />
          </div>
          {/* Search bar skeleton */}
          <div className="h-9 w-full rounded-lg bg-zinc-100 animate-pulse sm:w-72 shrink-0" />
        </div>
      </section>

      {/* Bento card grid skeleton */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {[1, 2, 3, 4, 5, 6].map((n) => (
          <div key={n} className="surface-card p-6 space-y-4 animate-pulse">
            <div className="h-5 bg-zinc-200 rounded w-2/3" />
            <div className="h-4 bg-zinc-100 rounded w-1/3" />
            <div className="space-y-2 pt-2">
              <div className="h-16 bg-zinc-100 rounded-lg" />
              <div className="h-16 bg-zinc-100 rounded-lg" />
            </div>
            <div className="h-9 bg-zinc-200 rounded-lg pt-2" />
          </div>
        ))}
      </div>
    </main>
  );
}
