import Header from "@/components/Header";
import { getAdminLeaderboard } from "@/lib/admin-api";

export const revalidate = 0;
export const dynamic = "force-dynamic";

export default async function LeaderboardPage() {
  const leaderboard = await getAdminLeaderboard();

  return (
    <>
      <Header showNav />
      <main className="page-shell">
        <section className="surface-card border-accent/20 bg-gradient-to-br from-accent/10 via-white to-accentAlt/10 p-5 sm:p-6">
          <p className="pill-chip">Referral momentum</p>
          <h1 className="page-title mt-3">Referral leaderboard</h1>
          <p className="page-subtitle">
            Sign-ups attributed to each PR member&apos;s referral link.
          </p>
        </section>

        <section className="surface-card mt-6 overflow-hidden">
          <table className="w-full border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/80 text-slate-600">
                <th className="px-4 py-3 font-semibold">#</th>
                <th className="px-4 py-3 font-semibold">Name</th>
                <th className="px-4 py-3 font-semibold">Code</th>
                <th className="px-4 py-3 font-semibold">Referrals</th>
              </tr>
            </thead>
            <tbody>
              {leaderboard.map((m, i) => (
                <tr
                  key={m.code}
                  className="border-b border-slate-100 last:border-0"
                >
                  <td className="px-4 py-3 text-slate-400">
                    {i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : i + 1}
                  </td>
                  <td className="px-4 py-3 font-medium text-ink">{m.name}</td>
                  <td className="px-4 py-3 font-mono text-xs text-slate-500">
                    {m.code}
                  </td>
                  <td className="px-4 py-3 font-semibold text-accent">
                    {m.count}
                  </td>
                </tr>
              ))}
              {leaderboard.length === 0 && (
                <tr>
                  <td
                    colSpan={4}
                    className="px-4 py-10 text-center text-slate-500"
                  >
                    No PR members yet.
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
