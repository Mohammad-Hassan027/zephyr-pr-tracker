"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import {
  approveRegistration,
  bulkApproveRegistrations,
  bulkRejectRegistrations,
  getEvents,
  getPendingQueue,
  EventItem,
  PendingRegistration,
  rejectRegistration,
} from "@/lib/api";
import { useDebouncedValue } from "@/lib/useDebouncedValue";

const PAGE_LIMIT = 20;

export default function PRQueue({ code }: { code?: string }) {
  const [items, setItems] = useState<PendingRegistration[]>([]);
  const [events, setEvents] = useState<EventItem[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [isBulkBusy, setIsBulkBusy] = useState(false);
  const [zoomed, setZoomed] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Selection state
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Rejection modal state
  const [rejectModal, setRejectModal] = useState<{
    isOpen: boolean;
    isBulk: boolean;
    targetId: string | null;
  }>({
    isOpen: false,
    isBulk: false,
    targetId: null,
  });
  const [rejectionReason, setRejectionReason] = useState("");

  // Pagination state
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);

  // Filter state
  const [eventSlug, setEventSlug] = useState("");
  const [college, setCollege] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const debouncedCollege = useDebouncedValue(college, 300);

  const fetchAbortRef = useRef<AbortController | null>(null);

  // Keyboard accessibility: Escape to close modals
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setZoomed(null);
        if (rejectModal.isOpen) {
          setRejectModal({ isOpen: false, isBulk: false, targetId: null });
        }
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [rejectModal.isOpen]);

  // Fetch available events on mount
  useEffect(() => {
    fetch("/api/admin/events")
      .then((r) => (r.ok ? r.json() : getEvents()))
      .then((data) => setEvents(Array.isArray(data) ? data : []))
      .catch(() => getEvents().then((data) => setEvents(Array.isArray(data) ? data : [])));
  }, []);

  const fetchQueue = useCallback(
    async (targetPage: number, signal: AbortSignal) => {
      setLoading(true);
      try {
        const data = await getPendingQueue(
          code,
          {
            event: eventSlug || undefined,
            college: debouncedCollege || undefined,
            from: from || undefined,
            to: to || undefined,
            page: targetPage,
            limit: PAGE_LIMIT,
          },
          signal,
        );
        if (signal.aborted) return;
        setItems(data.items);
        setSelectedIds(new Set()); // Reset selection on page reload
        setTotalPages(data.pagination.totalPages);
        setTotal(data.pagination.total);
        setPage(data.pagination.page);
      } catch (err) {
        if (signal.aborted || (err instanceof DOMException && err.name === "AbortError")) {
          return;
        }
        console.error("Failed to load queue", err);
      } finally {
        if (!signal.aborted) {
          setLoading(false);
        }
      }
    },
    [code, eventSlug, debouncedCollege, from, to],
  );

  // Re-fetch from page 1 whenever filters change
  useEffect(() => {
    fetchAbortRef.current?.abort();
    const controller = new AbortController();
    fetchAbortRef.current = controller;
    setPage(1);
    fetchQueue(1, controller.signal);
    return () => controller.abort();
  }, [fetchQueue]);

  const load = useCallback(
    async (targetPage = page) => {
      fetchAbortRef.current?.abort();
      const controller = new AbortController();
      fetchAbortRef.current = controller;
      await fetchQueue(targetPage, controller.signal);
    },
    [fetchQueue, page],
  );

  function handleToggleSelect(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function handleToggleSelectAll() {
    if (selectedIds.size === items.length && items.length > 0) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(items.map((i) => i._id)));
    }
  }

  async function handleApprove(id: string) {
    setBusyId(id);
    try {
      await approveRegistration(id, code);
      await load(page);
    } finally {
      setBusyId(null);
    }
  }

  function openRejectModal(id: string) {
    setRejectionReason("Payment screenshot could not be verified");
    setRejectModal({
      isOpen: true,
      isBulk: false,
      targetId: id,
    });
  }

  function openBulkRejectModal() {
    setRejectionReason("Payment screenshot could not be verified");
    setRejectModal({
      isOpen: true,
      isBulk: true,
      targetId: null,
    });
  }

  async function confirmRejection() {
    if (rejectModal.isBulk) {
      setIsBulkBusy(true);
      try {
        await bulkRejectRegistrations(
          Array.from(selectedIds),
          rejectionReason || undefined,
          code,
        );
        setRejectModal({ isOpen: false, isBulk: false, targetId: null });
        setSelectedIds(new Set());
        await load(page);
      } finally {
        setIsBulkBusy(false);
      }
    } else if (rejectModal.targetId) {
      setBusyId(rejectModal.targetId);
      try {
        await rejectRegistration(
          rejectModal.targetId,
          code,
          rejectionReason || undefined,
        );
        setRejectModal({ isOpen: false, isBulk: false, targetId: null });
        await load(page);
      } finally {
        setBusyId(null);
      }
    }
  }

  async function handleBulkApprove() {
    if (selectedIds.size === 0) return;
    setIsBulkBusy(true);
    try {
      await bulkApproveRegistrations(Array.from(selectedIds), code);
      setSelectedIds(new Set());
      await load(page);
    } finally {
      setIsBulkBusy(false);
    }
  }

  async function handlePageChange(newPage: number) {
    if (newPage < 1 || newPage > totalPages) return;
    await load(newPage);
  }

  const hasActiveFilters = Boolean(eventSlug || college || from || to);

  function handleClearFilters() {
    setEventSlug("");
    setCollege("");
    setFrom("");
    setTo("");
  }

  const isAllSelected = items.length > 0 && selectedIds.size === items.length;

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
            {!loading && (
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] text-slate-500">
                {total} total
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

      {/* Batch Select Controls Bar */}
      {!loading && items.length > 0 && (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 px-1">
          <label className="flex items-center gap-2 text-xs font-semibold text-slate-700 cursor-pointer">
            <input
              type="checkbox"
              checked={isAllSelected}
              onChange={handleToggleSelectAll}
              className="h-4 w-4 rounded border-slate-300 text-accent focus:ring-accent"
            />
            Select All on this page ({items.length})
          </label>

          {selectedIds.size > 0 && (
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-accent">
                {selectedIds.size} selected
              </span>
              <button
                type="button"
                onClick={handleBulkApprove}
                disabled={isBulkBusy}
                className="rounded-full bg-emerald-600 px-3.5 py-1 text-xs font-semibold text-white shadow-sm hover:bg-emerald-700 disabled:opacity-50 transition"
              >
                {isBulkBusy ? "Approving..." : `✓ Approve Selected (${selectedIds.size})`}
              </button>
              <button
                type="button"
                onClick={openBulkRejectModal}
                disabled={isBulkBusy}
                className="rounded-full bg-red-600 px-3.5 py-1 text-xs font-semibold text-white shadow-sm hover:bg-red-700 disabled:opacity-50 transition"
              >
                {isBulkBusy ? "Processing..." : `✕ Reject Selected (${selectedIds.size})`}
              </button>
              <button
                type="button"
                onClick={() => setSelectedIds(new Set())}
                className="text-xs text-slate-500 hover:text-slate-800"
              >
                Clear
              </button>
            </div>
          )}
        </div>
      )}

      {/* Pending Items List or Empty State */}
      {loading ? (
        <div className="surface-card mt-4 p-8 text-center">
          <div className="mx-auto mb-3 h-8 w-8 animate-spin rounded-full border-2 border-accent border-t-transparent" />
          <p className="text-sm text-slate-500">Loading queue…</p>
        </div>
      ) : items.length === 0 ? (
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
          {items.map((r) => {
            const isSelected = selectedIds.has(r._id);
            return (
              <div
                key={r._id}
                className={`surface-card border transition p-4 sm:p-5 ${
                  isSelected
                    ? "border-accent/60 bg-accent/5 ring-1 ring-accent/30"
                    : "border-accent/15 bg-white/90"
                }`}
              >
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  <div className="flex items-start gap-3 min-w-0">
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => handleToggleSelect(r._id)}
                      className="mt-1 h-4 w-4 rounded border-slate-300 text-accent focus:ring-accent cursor-pointer"
                    />
                    <div className="min-w-0 text-sm">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-semibold text-ink">{r.studentName}</p>
                        <span className="rounded-full bg-accentSoft px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-accent">
                          Pending
                        </span>
                        {r.event.fee !== undefined && r.amount !== undefined && r.amount !== r.event.fee && (
                          <span className="rounded-full bg-amber-100 px-2.5 py-1 text-[11px] font-semibold text-amber-800 ring-1 ring-inset ring-amber-400/30">
                            ⚠️ Amount Mismatch (₹{r.amount} vs expected ₹{r.event.fee})
                          </span>
                        )}
                      </div>
                      <p className="mt-1 text-slate-600 font-medium">{r.event.name}</p>
                      <p className="mt-1 text-xs text-slate-500">
                        {r.college || "—"} · {r.studentPhone || r.studentEmail}
                      </p>
                      <p className="mt-1 text-xs text-slate-500 font-medium">
                        ₹{r.amount ?? 0}
                        {r.referralCode ? ` · Ref: ${r.referralCode}` : " · Direct"}
                      </p>
                      {r.utr && (
                        <p className="mt-1 text-xs text-slate-400">
                          UTR: <span className="font-mono font-medium text-slate-600">{r.utr}</span>
                        </p>
                      )}
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => setZoomed(r.paymentScreenshot)}
                    className="relative h-24 w-24 shrink-0 cursor-pointer overflow-hidden rounded-2xl border border-slate-200 shadow-sm sm:h-28 sm:w-28 group"
                  >
                    <Image
                      src={r.paymentScreenshot}
                      alt="UPI screenshot"
                      fill
                      sizes="(max-width: 640px) 96px, 112px"
                      loading="lazy"
                      className="object-cover group-hover:scale-105 transition duration-200"
                    />
                    <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition flex items-center justify-center text-white text-[10px] font-semibold">
                      🔍 Zoom
                    </div>
                  </button>
                </div>
                <div className="mt-4 flex flex-col gap-2 sm:flex-row">
                  <button
                    disabled={busyId === r._id || isBulkBusy}
                    onClick={() => handleApprove(r._id)}
                    className="btn-primary flex-1 py-2 text-xs"
                  >
                    {busyId === r._id ? "Approving..." : "Approve"}
                  </button>
                  <button
                    disabled={busyId === r._id || isBulkBusy}
                    onClick={() => openRejectModal(r._id)}
                    className="btn-secondary flex-1 py-2 text-xs"
                  >
                    Reject
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Pagination Controls */}
      {!loading && totalPages > 1 && (
        <div className="mt-6 flex items-center justify-between gap-4">
          <p className="text-xs text-slate-500">
            Page <span className="font-semibold text-ink">{page}</span> of{" "}
            <span className="font-semibold text-ink">{totalPages}</span>
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={() => handlePageChange(page - 1)}
              disabled={page <= 1}
              className="rounded-full border border-slate-200 bg-white px-4 py-1.5 text-xs font-semibold text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
            >
              ← Previous
            </button>
            <button
              onClick={() => handlePageChange(page + 1)}
              disabled={page >= totalPages}
              className="rounded-full border border-slate-200 bg-white px-4 py-1.5 text-xs font-semibold text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Next →
            </button>
          </div>
        </div>
      )}

      {/* Rejection Modal Dialog (Replaces keyboard-hostile browser prompt) */}
      {rejectModal.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm">
          <div className="surface-card w-full max-w-md p-6 space-y-4 shadow-2xl">
            <h3 className="text-lg font-semibold text-ink">
              {rejectModal.isBulk
                ? `Reject ${selectedIds.size} Selected Registrations`
                : "Reject Registration"}
            </h3>
            <p className="text-xs text-slate-500">
              Provide a reason for rejection. This explanation will be displayed to the student on their status ticket.
            </p>

            <div className="space-y-2">
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500">
                Reason
              </label>
              <input
                type="text"
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                placeholder="e.g. UPI amount does not match event fee"
                className="field-input text-sm"
                autoFocus
              />

              <div className="flex flex-wrap gap-1.5 pt-1">
                {[
                  "Payment screenshot unreadable",
                  "Incorrect payment amount",
                  "Transaction ID not found",
                  "Duplicate submission",
                ].map((chip) => (
                  <button
                    key={chip}
                    type="button"
                    onClick={() => setRejectionReason(chip)}
                    className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] text-slate-600 hover:bg-slate-100 transition"
                  >
                    {chip}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex gap-2 justify-end pt-2">
              <button
                type="button"
                onClick={() =>
                  setRejectModal({ isOpen: false, isBulk: false, targetId: null })
                }
                className="btn-secondary py-1.5 px-4 text-xs"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmRejection}
                className="rounded-full bg-red-600 px-4 py-1.5 text-xs font-semibold text-white hover:bg-red-700 shadow-sm transition"
              >
                Confirm Rejection
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Screenshot Zoom Lightbox */}
      {zoomed && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4 sm:p-6 cursor-pointer"
          onClick={() => setZoomed(null)}
        >
          <div className="relative h-[min(90vh,800px)] w-[min(90vw,800px)]">
            <Image
              src={zoomed}
              alt="UPI screenshot full size"
              fill
              sizes="(max-width: 800px) 90vw, 800px"
              priority
              className="rounded-[24px] border border-white/20 object-contain shadow-2xl"
            />
          </div>
        </div>
      )}
    </>
  );
}
