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
        <section className="surface-card p-6 sm:p-7">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <span className="pill-chip">Live Analytics</span>
              <h1 className="page-title mt-2">Participation &amp; Seat Capacity</h1>
              <p className="page-subtitle">
                Real-time tracking of confirmed student registrations and remaining venue seat allocations.
              </p>
            </div>
            <div className="rounded-lg border border-zinc-200 bg-zinc-50/70 px-4 py-3 text-center sm:text-right shrink-0">
              <p className="text-[10px] font-mono uppercase tracking-wider text-zinc-400">
                Total Registrations
              </p>
              <p className="font-mono text-2xl font-bold text-zinc-900 mt-0.5">
                {total}
              </p>
            </div>
          </div>
        </section>

        <section className="surface-card p-5 sm:p-6 space-y-4">
          <div className="flex items-center justify-between border-b border-zinc-100 pb-3">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-900">
              Event Allocation Breakdown
            </h2>
          </div>

          <div className="overflow-x-auto rounded-lg border border-zinc-200">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-zinc-200 bg-zinc-50/80 text-[10px] font-mono uppercase tracking-wider text-zinc-400">
                <tr>
                  <th className="px-3.5 py-2.5">Event Name</th>
                  <th className="px-3.5 py-2.5">Confirmed</th>
                  <th className="px-3.5 py-2.5">Total Capacity</th>
                  <th className="px-3.5 py-2.5 min-w-[200px]">Fill Rate</th>
                  <th className="px-3.5 py-2.5 text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 bg-white">
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
                      className="transition hover:bg-zinc-50/70"
                    >
                      <td className="px-3.5 py-3 font-semibold text-zinc-900 font-sans">{s.name}</td>
                      <td className="px-3.5 py-3 font-mono font-bold text-brand-700">
                        {s.count}
                      </td>
                      <td className="px-3.5 py-3 font-mono text-zinc-500">
                        {s.capacity ?? "Unlimited"}
                      </td>
                      <td className="px-3.5 py-3">
                        {capacity ? (
                          <div className="space-y-1">
                            <div className="flex justify-between text-[11px] font-mono text-zinc-500">
                              <span>{s.count} / {capacity}</span>
                              <span className="font-bold text-zinc-900">{percent}%</span>
                            </div>
                            <div className="h-1.5 w-full overflow-hidden rounded-full bg-zinc-100">
                              <div
                                className={`h-full transition-all duration-500 ${
                                  isFull
                                    ? "bg-rose-500"
                                    : isNearlyFull
                                    ? "bg-amber-500"
                                    : "bg-brand-600"
                                }`}
                                style={{ width: `${percent}%` }}
                              />
                            </div>
                          </div>
                        ) : (
                          <span className="font-mono text-[11px] text-zinc-400">No limit</span>
                        )}
                      </td>
                      <td className="px-3.5 py-3 text-right">
                        {isFull ? (
                          <span className="badge-rejected">
                            Sold Out
                          </span>
                        ) : isNearlyFull ? (
                          <span className="badge-pending">
                            Filling Fast
                          </span>
                        ) : (
                          <span className="badge-approved">
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
                      className="px-4 py-8 text-center text-xs text-zinc-400 font-mono"
                    >
                      No active events tracked yet.
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
