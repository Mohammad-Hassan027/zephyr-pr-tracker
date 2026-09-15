export default function ClubRegisterLoading() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-xl items-center justify-center p-3 py-5 sm:p-6 lg:p-8">
      <div className="w-full space-y-5">
        {/* Header card skeleton */}
        <div className="surface-card p-5 sm:p-7 space-y-3">
          <div className="flex items-center justify-between">
            <div className="h-5 w-24 rounded-full bg-zinc-200 animate-pulse" />
            <div className="h-4 w-20 rounded bg-zinc-100 animate-pulse" />
          </div>
          <div className="h-7 w-48 rounded bg-zinc-200 animate-pulse" />
          <div className="h-4 w-full max-w-sm rounded bg-zinc-100 animate-pulse" />
        </div>

        {/* Form card skeleton */}
        <div className="surface-card space-y-6 p-5 sm:p-7 animate-pulse">
          {/* Section 1 */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 border-b border-zinc-100 pb-2">
              <div className="h-5 w-5 rounded bg-zinc-300" />
              <div className="h-4 w-36 rounded bg-zinc-200" />
            </div>
            <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
              <div className="h-14 rounded-lg bg-zinc-100" />
              <div className="h-14 rounded-lg bg-zinc-100" />
              <div className="h-14 rounded-lg bg-zinc-100" />
              <div className="h-14 rounded-lg bg-zinc-100" />
            </div>
          </div>

          {/* Section 2 */}
          <div className="space-y-3 pt-2">
            <div className="flex items-center gap-2 border-b border-zinc-100 pb-2">
              <div className="h-5 w-5 rounded bg-zinc-300" />
              <div className="h-4 w-28 rounded bg-zinc-200" />
            </div>
            <div className="h-10 rounded-lg bg-zinc-100" />
          </div>

          {/* Section 3 */}
          <div className="space-y-3 pt-2">
            <div className="flex items-center gap-2 border-b border-zinc-100 pb-2">
              <div className="h-5 w-5 rounded bg-zinc-300" />
              <div className="h-4 w-44 rounded bg-zinc-200" />
            </div>
            <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
              <div className="h-14 rounded-lg bg-zinc-100" />
              <div className="h-14 rounded-lg bg-zinc-100" />
            </div>
            <div className="h-14 rounded-lg bg-zinc-100" />
            <div className="h-24 rounded-lg border border-dashed border-zinc-200 bg-zinc-50" />
          </div>

          {/* Submit button */}
          <div className="h-10 w-full rounded-lg bg-zinc-200 pt-2" />
        </div>
      </div>
    </main>
  );
}
