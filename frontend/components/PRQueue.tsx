"use client";

import { useCallback, useEffect, useState } from "react";
import {
  approveRegistration,
  getEvents,
  getPendingQueue,
  EventItem,
  PendingRegistration,
  rejectRegistration,
} from "@/lib/api";

export default function PRQueue({ code }: { code?: string }) {
  const [items, setItems] = useState<PendingRegistration[]>([]);
  const [events, setEvents] = useState<EventItem[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [zoomed, setZoomed] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Filter state
  const [eventSlug, setEventSlug] = useState("");
  const [college, setCollege] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  // Fetch available events on mount
  useEffect(() => {
    fetch("/api/admin/events")
      .then((r) => (r.ok ? r.json() : getEvents()))
      .then((data) => setEvents(Array.isArray(data) ? data : []))
      .catch(() => getEvents().then((data) => setEvents(Array.isArray(data) ? data : [])));
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getPendingQueue(code, {
        event: eventSlug || undefined,
        college: college || undefined,
        from: from || undefined,
        to: to || undefined,
      });
      setItems(data);
    } catch (err) {
      console.error("Failed to load queue", err);
    } finally {
      setLoading(false);
    }
  }, [code, eventSlug, college, from, to]);

  useEffect(() => {
    load();
  }, [load]);

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

  const hasActiveFilters = Boolean(eventSlug || college || from || to);

  function handleClearFilters() {
    setEventSlug("");
    setCollege("");
    setFrom("");
    setTo("");
  }

  return (
    <>
      {/* Filter Bar */}
      <div className="surface-card mt-6 p-4 sm:p-5">
        <div className="flex items-center justify-between gap-2 border-b border-slate-200/70 pb-3 mb-4">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold text-ink">Filter Queue</h3>
            {hasActiveFilters && (
              <span className="rounded-full bg-accent/15 px-2 py-0.5 text-[11px] font-semibold text-accent">
                Filtered
              </span>
            )}
          </div>
          {hasActiveFilters && (
            <button
              type="button"
              onClick={handleClearFilters}
              className="text-xs font-semibold text-accent hover:underline"
            >
              Clear filters
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">
              Event
            </label>
            <select
              value={eventSlug}
              onChange={(e) => setEventSlug(e.target.value)}
              className="field-input text-xs"
            >
              <option value="">All Events</option>
              {events.map((ev) => (
                <option key={ev._id} value={ev.slug}>
                  {ev.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">
              College
            </label>
            <input
              type="text"
              placeholder="Search college..."
              value={college}
              onChange={(e) => setCollege(e.target.value)}
              className="field-input text-xs"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">
              From Date
            </label>
            <input
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              className="field-input text-xs"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">
              To Date
            </label>
            <input
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              className="field-input text-xs"
            />
          </div>
        </div>
      </div>

      {/* Pending Items List or Empty State */}
      {items.length === 0 ? (
        <div className="surface-card mt-4 p-8 text-center">
          <p className="text-lg font-semibold text-ink">
            {hasActiveFilters
              ? "No matching pending registrations."
              : "Nothing pending right now."}
          </p>
          <p className="mt-2 text-sm text-slate-600">
            {hasActiveFilters
              ? "Try adjusting or clearing your filters to see more results."
              : "New approvals will appear here as soon as a payment is submitted."}
          </p>
        </div>
      ) : (
        <div className="mt-4 space-y-3">
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
      )}

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
