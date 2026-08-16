import Header from "@/components/Header";
import { getAdminStats } from "@/lib/admin-api";

export const revalidate = 0;
export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const stats = await getAdminStats();
  const total = stats.reduce((sum, s) => sum + s.count, 0);

  return (
    <>
      <Header showNav />
      <main className="page-shell space-y-6">
        <section className="surface-card border-accent/20 bg-gradient-to-br from-accent/10 via-white to-accentAlt/10 p-5 sm:p-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="pill-chip">Live snapshot</p>
              <h1 className="page-title mt-3">Event Participation & Capacity</h1>
              <p className="page-subtitle mt-1">
                {total} confirmed registrations across club events.
              </p>
            </div>
            <div className="rounded-2xl border border-accent/20 bg-white/80 px-4 py-3 text-sm text-slate-600">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                Total Registrations
              </p>
              <p className="mt-1 font-display text-2xl font-semibold text-ink">
                {total}
              </p>
            </div>
          </div>
        </section>

        <section className="surface-card overflow-hidden p-5 sm:p-6 space-y-4">
          <h2 className="text-base font-semibold text-ink">Event Seat Allocations</h2>

          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/80 text-xs font-semibold uppercase tracking-wider text-slate-500">
                  <th className="px-4 py-3">Event</th>
                  <th className="px-4 py-3">Confirmed</th>
                  <th className="px-4 py-3">Capacity</th>
                  <th className="px-4 py-3 min-w-[200px]">Live Progress</th>
                  <th className="px-4 py-3 text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {stats.map((s) => {
                  const capacity = s.capacity || null;
                  const percent = capacity
                    ? Math.min(100, Math.round((s.count / capacity) * 100))
                    : null;
                  const isFull = capacity ? s.count >= capacity : false;
                  const isNearlyFull = capacity ? percent! >= 80 && !isFull : false;

                  return (
                    <tr
                      key={s.eventId}
                      className="transition hover:bg-slate-50/50"
                    >
                      <td className="px-4 py-3.5 font-semibold text-ink">{s.name}</td>
                      <td className="px-4 py-3.5 font-bold text-accent">
                        {s.count}
                      </td>
                      <td className="px-4 py-3.5 text-slate-500">
                        {s.capacity ?? "Unlimited"}
                      </td>
                      <td className="px-4 py-3.5">
                        {capacity ? (
                          <div className="space-y-1">
                            <div className="flex justify-between text-xs text-slate-500">
                              <span>{s.count} / {capacity}</span>
                              <span className="font-semibold text-ink">{percent}%</span>
                            </div>
                            <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
                              <div
                                className={`h-full transition-all duration-500 ${
                                  isFull
                                    ? "bg-red-500"
                                    : isNearlyFull
                                    ? "bg-amber-500"
                                    : "bg-accent"
                                }`}
                                style={{ width: `${percent}%` }}
                              />
                            </div>
                          </div>
                        ) : (
                          <span className="text-xs text-slate-400">No cap set</span>
                        )}
                      </td>
                      <td className="px-4 py-3.5 text-right">
                        {isFull ? (
                          <span className="inline-flex items-center rounded-full bg-red-50 px-2.5 py-0.5 text-xs font-semibold text-red-700 ring-1 ring-inset ring-red-600/20">
                            Sold Out
                          </span>
                        ) : isNearlyFull ? (
                          <span className="inline-flex items-center rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-semibold text-amber-700 ring-1 ring-inset ring-amber-600/20">
                            Filling Fast
                          </span>
                        ) : (
                          <span className="inline-flex items-center rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-700 ring-1 ring-inset ring-emerald-600/20">
                            Available
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
                {stats.length === 0 && (
                  <tr>
                    <td
                      colSpan={5}
                      className="px-4 py-10 text-center text-slate-500"
                    >
                      No events registered yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </main>
    </>
  );
}
