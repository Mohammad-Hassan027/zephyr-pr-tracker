"use client";

import { useEffect, useState } from "react";
import PRHeader from "@/components/PRHeader";
import PRQueue from "@/components/PRQueue";
import { changePRPin, getPRMemberStats, PRMemberStats } from "@/lib/api/members";

export default function PRDashboardClient({ code }: { code: string }) {
  const [stats, setStats] = useState<PRMemberStats | null>(null);
  const [loadingStats, setLoadingStats] = useState(true);
  const [activeTab, setActiveTab] = useState<"queue" | "referrals">("queue");

  // Change PIN modal state
  const [pinModalOpen, setPinModalOpen] = useState(false);
  const [oldPin, setOldPin] = useState("");
  const [newPin, setNewPin] = useState("");
  const [showOldPin, setShowOldPin] = useState(false);
  const [showNewPin, setShowNewPin] = useState(false);
  const [pinError, setPinError] = useState("");
  const [pinSuccess, setPinSuccess] = useState("");
  const [changingPin, setChangingPin] = useState(false);

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

  async function handlePinChange(e: React.FormEvent) {
    e.preventDefault();
    setPinError("");
    setPinSuccess("");
    if (!newPin || newPin.length < 4) {
      setPinError("New PIN must be at least 4 digits");
      return;
    }

    setChangingPin(true);
    try {
      await changePRPin(newPin, oldPin || undefined);
      setPinSuccess("Your PIN has been updated successfully!");
      setOldPin("");
      setNewPin("");
      setTimeout(() => {
        setPinModalOpen(false);
        setPinSuccess("");
      }, 1500);
    } catch (err: any) {
      setPinError(err.message || "Failed to update PIN");
    } finally {
      setChangingPin(false);
    }
  }

  const totalReferrals = stats
    ? stats.totalApproved + stats.totalPending + stats.totalRejected
    : 0;

  return (
    <>
      <PRHeader code={code} />
      <main className="page-shell max-w-5xl space-y-6 py-6 sm:py-8">
        {/* Hero Section */}
        <section className="surface-card p-6 sm:p-7">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="flex items-center gap-2">
                <span className="pill-chip">PR Operations</span>
                <span className="font-mono text-xs font-bold text-brand-700 bg-brand-50 border border-brand-200/60 rounded px-1.5 py-0.5">
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
              onClick={() => {
                setPinError("");
                setPinSuccess("");
                setPinModalOpen(true);
              }}
              className="btn-secondary self-start sm:self-auto text-xs py-2 px-3.5 shrink-0"
            >
              Update PIN
            </button>
          </div>

          {/* Stats Bento */}
          <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
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
        <div className="flex gap-2 border-b border-zinc-200 pb-2">
          <button
            type="button"
            onClick={() => setActiveTab("queue")}
            className={`rounded-lg px-3.5 py-1.5 text-xs font-medium transition ${
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
            className={`rounded-lg px-3.5 py-1.5 text-xs font-medium transition ${
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
          <section className="surface-card p-5 sm:p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-zinc-100 pb-3">
              <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-900">
                Registrations Referred by {code}
              </h2>
              <button
                type="button"
                onClick={loadStats}
                className="text-xs font-medium text-brand-600 hover:underline"
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
              <div className="overflow-x-auto rounded-lg border border-zinc-200">
                <table className="w-full text-left text-xs">
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
                            <span className="badge-approved">
                              Approved
                            </span>
                          ) : item.status === "rejected" ? (
                            <span className="badge-rejected" title={item.rejectionReason || undefined}>
                              Rejected
                            </span>
                          ) : (
                            <span className="badge-pending">
                              Pending
                            </span>
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
            )}
          </section>
        )}

        {/* Change PIN Modal */}
        {pinModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/50 p-4 backdrop-blur-sm">
            <div className="surface-card w-full max-w-sm p-6 shadow-elevated space-y-4">
              <div className="flex items-center justify-between border-b border-zinc-100 pb-3">
                <h3 className="text-sm font-bold text-zinc-900">Update Security PIN</h3>
                <button
                  type="button"
                  onClick={() => setPinModalOpen(false)}
                  className="text-zinc-400 hover:text-zinc-600 text-xs"
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
                    Current PIN (Optional if resetting)
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
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 text-xs"
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
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 text-xs"
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

                <div className="flex gap-2 justify-end pt-2 border-t border-zinc-100">
                  <button
                    type="button"
                    onClick={() => setPinModalOpen(false)}
                    className="btn-secondary py-1.5 px-3 text-xs"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={changingPin}
                    className="btn-primary py-1.5 px-4 text-xs font-medium"
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
