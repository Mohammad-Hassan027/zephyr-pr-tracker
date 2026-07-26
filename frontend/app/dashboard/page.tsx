import Header from "@/components/Header";
import { getStats } from "@/lib/api";

export default async function DashboardPage() {
  const stats = await getStats();
  const total = stats.reduce((sum, s) => sum + s.count, 0);

  return (
    <>
      <Header showNav />
      <main className="page-shell">
        <section className="surface-card border-accent/20 bg-gradient-to-br from-accent/10 via-white to-accentAlt/10 p-5 sm:p-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="pill-chip">Live snapshot</p>
              <h1 className="page-title mt-3">Event participation</h1>
              <p className="page-subtitle mt-1">
                {total} registrations across Zephyr events.
              </p>
            </div>
            <div className="rounded-2xl border border-accent/20 bg-white/80 px-4 py-3 text-sm text-slate-600">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                Total
              </p>
              <p className="mt-1 font-display text-2xl font-semibold text-ink">
                {total}
              </p>
            </div>
          </div>
        </section>

        <section className="surface-card mt-6 overflow-hidden">
          <table className="w-full border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/80 text-slate-600">
                <th className="px-4 py-3 font-semibold">Event</th>
                <th className="px-4 py-3 font-semibold">Registered</th>
                <th className="px-4 py-3 font-semibold">Capacity</th>
              </tr>
            </thead>
            <tbody>
              {stats.map((s) => (
                <tr
                  key={s.eventId}
                  className="border-b border-slate-100 last:border-0"
                >
                  <td className="px-4 py-3 font-medium text-ink">{s.name}</td>
                  <td className="px-4 py-3 font-semibold text-accent">
                    {s.count}
                  </td>
                  <td className="px-4 py-3 text-slate-500">
                    {s.capacity ?? "—"}
                  </td>
                </tr>
              ))}
              {stats.length === 0 && (
                <tr>
                  <td
                    colSpan={3}
                    className="px-4 py-10 text-center text-slate-500"
                  >
                    No registrations yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </section>
      </main>
    </>
  );
}
