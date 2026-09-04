"use client";

import { useEffect, useState } from "react";
import PRHeader from "@/components/PRHeader";
import PRQueue from "@/components/PRQueue";
import { getPRMemberStats } from "@/lib/api/members";
import type { PRMemberStats } from "@/lib/api/members";
import { useChangePRPin } from "@/features/pr-dashboard/useChangePRPin";

export default function PRDashboardClient({ code }: { code: string }) {
  const [stats, setStats] = useState<PRMemberStats | null>(null);
  const [loadingStats, setLoadingStats] = useState(true);
  const [activeTab, setActiveTab] = useState<"queue" | "referrals">("queue");

  const {
    pinModalOpen,
    oldPin,
    newPin,
    showOldPin,
    showNewPin,
    pinError,
    pinSuccess,
    changingPin,
    openPinModal,
    setPinModalOpen,
    setOldPin,
    setNewPin,
    setShowOldPin,
    setShowNewPin,
    handlePinChange,
  } = useChangePRPin();

  async function loadStats() {
    try {
      setLoadingStats(true);
      const data = await getPRMemberStats();
      setStats(data);
    } catch (err) {
      console.error("Failed to load PR stats", err);
    } finally {
      setLoadingStats(false);
    }
  }

  useEffect(() => {
    loadStats();
  }, []);

  const totalReferrals = stats
    ? stats.totalApproved + stats.totalPending + stats.totalRejected
    : 0;

  return (
    <>
      <PRHeader code={code} />
      <main className="page-shell max-w-5xl space-y-6 py-5 sm:py-8">
        {/* Hero Section */}
        <section className="surface-card p-5 sm:p-7">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="pill-chip">PR Operations</span>
                <span className="min-w-0 break-all rounded border border-brand-200/60 bg-brand-50 px-1.5 py-0.5 font-mono text-xs font-bold text-brand-700">
                  {code}
                </span>
              </div>
              <h1 className="page-title mt-2">PR Review Station</h1>
              <p className="page-subtitle">
                Verify payment proofs for student submissions, monitor your referral pipeline, and track conversions.
              </p>
            </div>
            <button
              type="button"
              onClick={openPinModal}
              className="btn-secondary w-full shrink-0 px-3.5 py-2 text-xs sm:w-auto"
            >
              Update PIN
            </button>
          </div>

          {/* Stats Bento */}
          <div className="mt-6 grid grid-cols-1 gap-3 min-[375px]:grid-cols-2 sm:grid-cols-4">
            <div className="rounded-lg border border-zinc-200 bg-zinc-50/60 p-3.5">
              <p className="text-[10px] font-mono uppercase tracking-wider text-zinc-400">
                Approved
              </p>
              <p className="mt-1 font-mono text-2xl font-bold text-emerald-600">
                {loadingStats ? "…" : stats?.totalApproved ?? 0}
              </p>
              <p className="mt-0.5 text-[10px] text-zinc-400 font-mono">Confirmed seats</p>
            </div>

            <div className="rounded-lg border border-zinc-200 bg-zinc-50/60 p-3.5">
              <p className="text-[10px] font-mono uppercase tracking-wider text-zinc-400">
                Pending Queue
              </p>
              <p className="mt-1 font-mono text-2xl font-bold text-amber-600">
                {loadingStats ? "…" : stats?.totalPending ?? 0}
              </p>
              <p className="mt-0.5 text-[10px] text-zinc-400 font-mono">Awaiting review</p>
            </div>

            <div className="rounded-lg border border-zinc-200 bg-zinc-50/60 p-3.5">
              <p className="text-[10px] font-mono uppercase tracking-wider text-zinc-400">
                Revenue Credited
              </p>
              <p className="mt-1 font-mono text-2xl font-bold text-brand-700">
                {loadingStats ? "…" : `₹${stats?.totalRevenue ?? 0}`}
              </p>
              <p className="mt-0.5 text-[10px] text-zinc-400 font-mono">Via your approvals</p>
            </div>

            <div className="rounded-lg border border-zinc-200 bg-zinc-50/60 p-3.5">
              <p className="text-[10px] font-mono uppercase tracking-wider text-zinc-400">
                Total Submissions
              </p>
              <p className="mt-1 font-mono text-2xl font-bold text-zinc-900">
                {loadingStats ? "…" : totalReferrals}
              </p>
              <p className="mt-0.5 text-[10px] text-zinc-400 font-mono">Lifetime referrals</p>
            </div>
          </div>
        </section>

        {/* Tab Navigation */}
        <div className="grid grid-cols-1 gap-2 border-b border-zinc-200 pb-2 sm:flex sm:flex-wrap">
          <button
            type="button"
            onClick={() => setActiveTab("queue")}
            className={`min-h-10 rounded-lg px-3.5 py-2 text-xs font-medium transition focus:outline-none focus:ring-2 focus:ring-brand-500/20 ${
              activeTab === "queue"
                ? "bg-zinc-900 text-white shadow-subtle"
                : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200"
            }`}
          >
            Pending Verification Queue ({stats?.totalPending ?? 0})
          </button>
          <button
            type="button"
            onClick={() => {
              setActiveTab("referrals");
              loadStats();
            }}
            className={`min-h-10 rounded-lg px-3.5 py-2 text-xs font-medium transition focus:outline-none focus:ring-2 focus:ring-brand-500/20 ${
              activeTab === "referrals"
                ? "bg-zinc-900 text-white shadow-subtle"
                : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200"
            }`}
          >
            Referral Attribution Log ({stats?.referrals?.length ?? 0})
          </button>
        </div>

        {/* Content Area */}
        {activeTab === "queue" ? (
          <section>
            <PRQueue code={code} />
          </section>
        ) : (
          <section className="surface-card space-y-4 p-4 sm:p-6">
            <div className="flex flex-col gap-2 border-b border-zinc-100 pb-3 sm:flex-row sm:items-center sm:justify-between">
              <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-900">
                Registrations Referred by {code}
              </h2>
              <button
                type="button"
                onClick={loadStats}
                className="min-h-8 self-start text-xs font-medium text-brand-600 hover:underline focus:outline-none focus:ring-2 focus:ring-brand-500/20"
              >
                Refresh Log
              </button>
            </div>

            {loadingStats ? (
              <div className="flex flex-col items-center gap-2 p-10">
                <div className="h-6 w-6 animate-spin rounded-full border-2 border-brand-600 border-t-transparent" />
                <p className="text-xs text-zinc-400 font-mono">Loading referral history…</p>
              </div>
            ) : !stats?.referrals || stats.referrals.length === 0 ? (
              <div className="rounded-lg border border-dashed border-zinc-200 p-8 text-center text-xs text-zinc-400 font-mono">
                No student registrations linked with your code yet. Share your referral link to build momentum!
              </div>
            ) : (
              <>
                <div className="space-y-3 md:hidden">
                  {stats.referrals.map((item) => (
                    <article
                      key={item.id}
                      className="rounded-lg border border-zinc-200 bg-white p-4 text-xs shadow-subtle"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="break-words font-sans text-sm font-semibold text-zinc-900">
                            {item.studentName}
                          </p>
                          <p className="mt-0.5 break-all font-mono text-[11px] text-zinc-400">
                            {item.studentEmail}
                          </p>
                        </div>
                        <span className="shrink-0">
                          {item.status === "approved" ? (
                            <span className="badge-approved">Approved</span>
                          ) : item.status === "rejected" ? (
                            <span className="badge-rejected" title={item.rejectionReason || undefined}>
                              Rejected
                            </span>
                          ) : (
                            <span className="badge-pending">Pending</span>
                          )}
                        </span>
                      </div>

                      <div className="mt-3 grid grid-cols-2 gap-2">
                        <div className="rounded-lg border border-zinc-200 bg-zinc-50/70 p-2">
                          <span className="block font-mono text-[10px] uppercase tracking-wider text-zinc-400">
                            Reg No
                          </span>
                          <span className="mt-0.5 block break-all font-mono font-bold text-zinc-900">
                            {item.regNo || "—"}
                          </span>
                        </div>
                        <div className="rounded-lg border border-zinc-200 bg-zinc-50/70 p-2">
                          <span className="block font-mono text-[10px] uppercase tracking-wider text-zinc-400">
                            Fee
                          </span>
                          <span className="mt-0.5 block font-mono font-bold text-zinc-900">
                            ₹{item.amount ?? 0}
                          </span>
                        </div>
                        <div className="col-span-2 rounded-lg border border-zinc-200 bg-zinc-50/70 p-2">
                          <span className="block font-mono text-[10px] uppercase tracking-wider text-zinc-400">
                            Event
                          </span>
                          <span className="mt-0.5 block break-words font-medium text-zinc-700">
                            {item.event?.name || "—"}
                          </span>
                        </div>
                        <div className="col-span-2 rounded-lg border border-zinc-200 bg-zinc-50/70 p-2">
                          <span className="block font-mono text-[10px] uppercase tracking-wider text-zinc-400">
                            Submitted
                          </span>
                          <span className="mt-0.5 block font-mono text-zinc-700">
                            {new Date(item.createdAt).toLocaleDateString()}
                          </span>
                        </div>
                      </div>
                    </article>
                  ))}
                </div>

                <div
                  className="scroll-container hidden md:block"
                  tabIndex={0}
                  aria-label="Referral attribution table. Scroll horizontally if needed."
                >
                  <table className="w-full min-w-[720px] text-left text-xs">
                  <thead className="border-b border-zinc-200 bg-zinc-50/80 text-[10px] font-mono uppercase tracking-wider text-zinc-400">
                    <tr>
                      <th className="px-3.5 py-2.5">Reg No</th>
                      <th className="px-3.5 py-2.5">Candidate</th>
                      <th className="px-3.5 py-2.5">Event</th>
                      <th className="px-3.5 py-2.5">Fee</th>
                      <th className="px-3.5 py-2.5">Status</th>
                      <th className="px-3.5 py-2.5">Submitted Date</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100 bg-white">
                    {stats.referrals.map((item) => (
                      <tr key={item.id} className="transition hover:bg-zinc-50/70">
                        <td className="whitespace-nowrap px-3.5 py-3 font-mono font-bold text-zinc-900">
                          {item.regNo || "—"}
                        </td>
                        <td className="px-3.5 py-3">
                          <p className="font-medium text-zinc-900 font-sans">{item.studentName}</p>
                          <p className="text-[11px] text-zinc-400 font-mono">{item.studentEmail}</p>
                        </td>
                        <td className="px-3.5 py-3 font-medium text-zinc-700 font-sans">
                          {item.event?.name || "—"}
                        </td>
                        <td className="whitespace-nowrap px-3.5 py-3 font-mono font-bold text-zinc-900">
                          ₹{item.amount ?? 0}
                        </td>
                        <td className="whitespace-nowrap px-3.5 py-3">
                          {item.status === "approved" ? (
                            <span className="badge-approved">Approved</span>
                          ) : item.status === "rejected" ? (
                            <span className="badge-rejected" title={item.rejectionReason || undefined}>
                              Rejected
                            </span>
                          ) : (
                            <span className="badge-pending">Pending</span>
                          )}
                        </td>
                        <td className="whitespace-nowrap px-3.5 py-3 text-[11px] font-mono text-zinc-500">
                          {new Date(item.createdAt).toLocaleDateString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  </table>
                </div>
              </>
            )}
          </section>
        )}

        {/* Change PIN Modal */}
        {pinModalOpen && (
          <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="pin-modal-title">
            <div className="modal-panel max-w-sm space-y-4 shadow-elevated">
              <div className="flex items-start justify-between gap-3 border-b border-zinc-100 pb-3">
                <h3 id="pin-modal-title" className="text-sm font-bold text-zinc-900">Update Security PIN</h3>
                <button
                  type="button"
                  onClick={() => setPinModalOpen(false)}
                  className="inline-flex min-h-10 min-w-10 shrink-0 items-center justify-center rounded-lg text-xs text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-zinc-900/10"
                  aria-label="Close PIN dialog"
                >
                  ✕
                </button>
              </div>

              <p className="text-xs text-zinc-500">
                Update the 6-digit access PIN you use to authenticate into this portal.
              </p>

              <form onSubmit={handlePinChange} className="space-y-3">
                <div>
                  <label className="block text-[10px] font-mono uppercase text-zinc-400 mb-1">
                    Current PIN
                  </label>
                  <div className="relative">
                    <input
                      type={showOldPin ? "text" : "password"}
                      value={oldPin}
                      onChange={(e) => setOldPin(e.target.value)}
                      placeholder="Current PIN"
                      className="field-input text-xs font-mono pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowOldPin(!showOldPin)}
                      className="absolute right-1.5 top-1/2 inline-flex min-h-9 -translate-y-1/2 items-center rounded px-2 text-xs text-zinc-400 hover:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
                      aria-label={showOldPin ? "Hide PIN" : "Show PIN"}
                    >
                      {showOldPin ? "Hide" : "Show"}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-mono uppercase text-zinc-400 mb-1">
                    New PIN (min 4 digits)
                  </label>
                  <div className="relative">
                    <input
                      type={showNewPin ? "text" : "password"}
                      required
                      value={newPin}
                      onChange={(e) => setNewPin(e.target.value)}
                      placeholder="e.g. 849201"
                      className="field-input text-xs font-mono pr-10"
                      autoFocus
                    />
                    <button
                      type="button"
                      onClick={() => setShowNewPin(!showNewPin)}
                      className="absolute right-1.5 top-1/2 inline-flex min-h-9 -translate-y-1/2 items-center rounded px-2 text-xs text-zinc-400 hover:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
                      aria-label={showNewPin ? "Hide PIN" : "Show PIN"}
                    >
                      {showNewPin ? "Hide" : "Show"}
                    </button>
                  </div>
                </div>

                {pinError && (
                  <div className="rounded-lg border border-rose-200 bg-rose-50 p-2 text-xs text-rose-700">
                    {pinError}
                  </div>
                )}

                {pinSuccess && (
                  <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-2 text-xs text-emerald-700">
                    {pinSuccess}
                  </div>
                )}

                <div className="flex flex-col-reverse gap-2 border-t border-zinc-100 pt-2 min-[400px]:flex-row min-[400px]:justify-end">
                  <button
                    type="button"
                    onClick={() => setPinModalOpen(false)}
                    className="btn-secondary px-3 py-2 text-xs"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={changingPin}
                    className="btn-primary px-4 py-2 text-xs font-medium"
                  >
                    {changingPin ? "Saving..." : "Save PIN"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </main>
    </>
  );
}
