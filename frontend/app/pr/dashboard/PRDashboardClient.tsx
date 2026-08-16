"use client";

import { useEffect, useState } from "react";
import PRHeader from "@/components/PRHeader";
import PRQueue from "@/components/PRQueue";
import { changePRPin, getPRMemberStats, PRMemberStats } from "@/lib/api";

export default function PRDashboardClient({ code }: { code: string }) {
  const [stats, setStats] = useState<PRMemberStats | null>(null);
  const [loadingStats, setLoadingStats] = useState(true);
  const [activeTab, setActiveTab] = useState<"queue" | "referrals">("queue");

  // Change PIN modal state
  const [pinModalOpen, setPinModalOpen] = useState(false);
  const [oldPin, setOldPin] = useState("");
  const [newPin, setNewPin] = useState("");
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
        <section className="surface-card border-accent/20 bg-gradient-to-br from-accent/10 via-white to-accentAlt/10 p-5 sm:p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="pill-chip">PR Member Dashboard</p>
              <h1 className="page-title mt-2">Welcome, {code}</h1>
              <p className="page-subtitle">
                Track your event referrals, verify incoming payments, and manage your access credentials.
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                setPinError("");
                setPinSuccess("");
                setPinModalOpen(true);
              }}
              className="btn-secondary self-start sm:self-auto text-xs py-2 px-4 shrink-0"
            >
              🔒 Change My PIN
            </button>
          </div>

          {/* Stats Bar */}
          <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="rounded-2xl border border-slate-200/80 bg-white/90 p-4 shadow-sm">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                Approved
              </p>
              <p className="mt-1 text-2xl font-bold text-emerald-600">
                {loadingStats ? "…" : stats?.totalApproved ?? 0}
              </p>
              <p className="mt-0.5 text-[11px] text-slate-400">Confirmed seats</p>
            </div>

            <div className="rounded-2xl border border-slate-200/80 bg-white/90 p-4 shadow-sm">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                Pending Queue
              </p>
              <p className="mt-1 text-2xl font-bold text-amber-600">
                {loadingStats ? "…" : stats?.totalPending ?? 0}
              </p>
              <p className="mt-0.5 text-[11px] text-slate-400">Needs review</p>
            </div>

            <div className="rounded-2xl border border-slate-200/80 bg-white/90 p-4 shadow-sm">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                Total Revenue
              </p>
              <p className="mt-1 text-2xl font-bold text-accent">
                {loadingStats ? "…" : `₹${stats?.totalRevenue ?? 0}`}
              </p>
              <p className="mt-0.5 text-[11px] text-slate-400">From approvals</p>
            </div>

            <div className="rounded-2xl border border-slate-200/80 bg-white/90 p-4 shadow-sm">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                Total Referrals
              </p>
              <p className="mt-1 text-2xl font-bold text-ink">
                {loadingStats ? "…" : totalReferrals}
              </p>
              <p className="mt-0.5 text-[11px] text-slate-400">Lifetime submissions</p>
            </div>
          </div>
        </section>

        {/* Tab Navigation */}
        <div className="flex gap-2 border-b border-slate-200/80 pb-1">
          <button
            type="button"
            onClick={() => setActiveTab("queue")}
            className={`rounded-full px-4 py-2 text-xs font-semibold transition ${
              activeTab === "queue"
                ? "bg-accent text-white shadow-sm"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
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
            className={`rounded-full px-4 py-2 text-xs font-semibold transition ${
              activeTab === "referrals"
                ? "bg-accent text-white shadow-sm"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            My Referrals History ({stats?.referrals?.length ?? 0})
          </button>
        </div>

        {/* Content Area */}
        {activeTab === "queue" ? (
          <section>
            <PRQueue code={code} />
          </section>
        ) : (
          <section className="surface-card p-5 sm:p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold text-ink">Referrals Using Your Code ({code})</h2>
              <button
                type="button"
                onClick={loadStats}
                className="text-xs font-semibold text-accent hover:underline"
              >
                Refresh
              </button>
            </div>

            {loadingStats ? (
              <div className="flex flex-col items-center gap-3 p-8">
                <div className="h-8 w-8 animate-spin rounded-full border-2 border-accent border-t-transparent" />
                <p className="text-sm text-slate-500">Loading your referral history…</p>
              </div>
            ) : !stats?.referrals || stats.referrals.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-200 p-8 text-center text-sm text-slate-500">
                No registrations have used your referral code yet. Share your code with students to start tracking!
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm text-slate-600">
                  <thead className="border-b border-slate-200 bg-slate-50/80 text-xs font-semibold uppercase tracking-wider text-slate-500">
                    <tr>
                      <th className="px-4 py-3">Reg No</th>
                      <th className="px-4 py-3">Student Name</th>
                      <th className="px-4 py-3">Event</th>
                      <th className="px-4 py-3">Amount</th>
                      <th className="px-4 py-3">Status</th>
                      <th className="px-4 py-3">Date</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {stats.referrals.map((item) => (
                      <tr key={item.id} className="transition hover:bg-slate-50/50">
                        <td className="whitespace-nowrap px-4 py-3 font-mono font-medium text-ink">
                          {item.regNo || "—"}
                        </td>
                        <td className="px-4 py-3">
                          <p className="font-medium text-ink">{item.studentName}</p>
                          <p className="text-xs text-slate-400">{item.studentEmail}</p>
                        </td>
                        <td className="px-4 py-3 font-medium text-slate-700">
                          {item.event?.name || "—"}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 font-semibold text-ink">
                          ₹{item.amount ?? 0}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3">
                          {item.status === "approved" ? (
                            <span className="inline-flex items-center rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-medium text-emerald-700 ring-1 ring-inset ring-emerald-600/20">
                              Approved
                            </span>
                          ) : item.status === "rejected" ? (
                            <span className="inline-flex items-center rounded-full bg-rose-50 px-2.5 py-0.5 text-xs font-medium text-rose-700 ring-1 ring-inset ring-rose-600/20" title={item.rejectionReason}>
                              Rejected
                            </span>
                          ) : (
                            <span className="inline-flex items-center rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-medium text-amber-700 ring-1 ring-inset ring-amber-600/20">
                              Pending
                            </span>
                          )}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-xs text-slate-400">
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
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm">
            <div className="surface-card w-full max-w-sm p-6 shadow-2xl space-y-4">
              <h3 className="text-lg font-semibold text-ink">Change Your PIN</h3>
              <p className="text-xs text-slate-500">
                Update the PIN you use to log in to the PR member portal.
              </p>

              <form onSubmit={handlePinChange} className="space-y-3">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1">
                    Current PIN (Optional if unknown)
                  </label>
                  <input
                    type="password"
                    value={oldPin}
                    onChange={(e) => setOldPin(e.target.value)}
                    placeholder="Enter current PIN"
                    className="field-input text-sm"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1">
                    New PIN (min 4 digits)
                  </label>
                  <input
                    type="password"
                    required
                    value={newPin}
                    onChange={(e) => setNewPin(e.target.value)}
                    placeholder="e.g. 123456"
                    className="field-input text-sm"
                    autoFocus
                  />
                </div>

                {pinError && (
                  <p className="rounded-xl border border-red-200 bg-red-50 p-2 text-xs text-red-700">
                    {pinError}
                  </p>
                )}

                {pinSuccess && (
                  <p className="rounded-xl border border-emerald-200 bg-emerald-50 p-2 text-xs text-emerald-700">
                    {pinSuccess}
                  </p>
                )}

                <div className="flex gap-2 justify-end pt-2">
                  <button
                    type="button"
                    onClick={() => setPinModalOpen(false)}
                    className="btn-secondary py-1.5 px-4 text-xs"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={changingPin}
                    className="btn-primary py-1.5 px-4 text-xs"
                  >
                    {changingPin ? "Updating..." : "Update PIN"}
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
