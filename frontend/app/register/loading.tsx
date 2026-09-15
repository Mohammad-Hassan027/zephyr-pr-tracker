export default function RegisterLoading() {
  return (
    <main className="page-shell max-w-2xl space-y-6 py-5 sm:py-10">
      {/* Header card skeleton */}
      <section className="surface-card p-5 sm:p-7 space-y-3">
        <div className="h-5 w-24 rounded-full bg-zinc-200 animate-pulse" />
        <div className="h-7 w-64 rounded bg-zinc-200 animate-pulse" />
        <div className="h-4 w-full max-w-md rounded bg-zinc-100 animate-pulse" />
      </section>

      {/* Selector form card skeleton */}
      <section className="surface-card p-5 sm:p-7 space-y-5 animate-pulse">
        <div className="space-y-2">
          <div className="h-4 w-40 rounded bg-zinc-200" />
          <div className="h-9 w-full rounded-lg bg-zinc-100" />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
            <div className="h-20 rounded-lg bg-zinc-100" />
            <div className="h-20 rounded-lg bg-zinc-100" />
            <div className="h-20 rounded-lg bg-zinc-100" />
            <div className="h-20 rounded-lg bg-zinc-100" />
          </div>
        </div>

        <div className="space-y-2 pt-2">
          <div className="h-4 w-48 rounded bg-zinc-200" />
          <div className="h-9 w-full rounded-lg bg-zinc-100" />
        </div>

        <div className="h-10 w-full rounded-lg bg-zinc-200 pt-2" />
      </section>
    </main>
  );
}
