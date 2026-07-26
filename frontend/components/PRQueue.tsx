"use client";

import { useEffect, useState } from "react";
import {
  approveRegistration,
  getPendingQueue,
  PendingRegistration,
  rejectRegistration,
} from "@/lib/api";

export default function PRQueue({ code }: { code?: string }) {
  const [items, setItems] = useState<PendingRegistration[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [zoomed, setZoomed] = useState<string | null>(null);

  async function load() {
    setItems(await getPendingQueue(code));
  }

  useEffect(() => {
    load();
  }, [code]);

  async function handleApprove(id: string) {
    setBusyId(id);
    try {
      await approveRegistration(id, code);
      await load();
    } finally {
      setBusyId(null);
    }
  }

  async function handleReject(id: string) {
    const reason = prompt("Reason for rejecting (optional):") || undefined;
    setBusyId(id);
    try {
      await rejectRegistration(id, code, reason);
      await load();
    } finally {
      setBusyId(null);
    }
  }

  if (items.length === 0) {
    return (
      <div className="surface-card mt-8 p-8 text-center">
        <p className="text-lg font-semibold text-ink">
          Nothing pending right now.
        </p>
        <p className="mt-2 text-sm text-slate-600">
          New approvals will appear here as soon as a payment is submitted.
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="mt-6 space-y-3">
        {items.map((r) => (
          <div
            key={r._id}
            className="surface-card border-accent/15 bg-white/90 p-4 sm:p-5"
          >
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0 text-sm">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-semibold text-ink">{r.studentName}</p>
                  <span className="rounded-full bg-accentSoft px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-accent">
                    Pending
                  </span>
                </div>
                <p className="mt-1 text-slate-600">{r.event.name}</p>
                <p className="mt-2 text-xs text-slate-500">
                  {r.college || "—"} · {r.studentPhone || r.studentEmail}
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  ₹{r.amount ?? 0}
                  {r.referralCode ? ` · ref ${r.referralCode}` : ""}
                </p>
              </div>
              <img
                src={r.paymentScreenshot}
                alt="UPI screenshot"
                className="h-24 w-24 cursor-pointer rounded-2xl border border-slate-200 object-cover shadow-sm sm:h-28 sm:w-28"
                onClick={() => setZoomed(r.paymentScreenshot)}
              />
            </div>
            <div className="mt-4 flex flex-col gap-2 sm:flex-row">
              <button
                disabled={busyId === r._id}
                onClick={() => handleApprove(r._id)}
                className="btn-primary flex-1"
              >
                Approve
              </button>
              <button
                disabled={busyId === r._id}
                onClick={() => handleReject(r._id)}
                className="btn-secondary flex-1"
              >
                Reject
              </button>
            </div>
          </div>
        ))}
      </div>

      {zoomed && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4 sm:p-6"
          onClick={() => setZoomed(null)}
        >
          <img
            src={zoomed}
            alt="UPI screenshot full size"
            className="max-h-full max-w-full rounded-[24px] border border-white/20 shadow-2xl"
          />
        </div>
      )}
    </>
  );
}
