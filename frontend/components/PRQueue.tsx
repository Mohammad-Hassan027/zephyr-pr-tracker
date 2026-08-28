"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import { getEvents } from "@/lib/api/events";
import {
  approveRegistration,
  bulkApproveRegistrations,
  bulkRejectRegistrations,
  getPendingQueue,
  rejectRegistration,
} from "@/lib/api/review-queue";
import type { EventItem, PendingRegistration } from "@/lib/api/types";
import { useDebouncedValue } from "@/lib/useDebouncedValue";
import {
  CheckCircle2,
  XCircle,
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  Inbox,
  ZoomIn,
  SlidersHorizontal,
  X,
} from "@/lib/icons";
import StatusIcon from "@/components/icons/StatusIcon";

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
      <div className="surface-card mt-4 p-4 sm:p-5">
        <div className="flex items-center justify-between gap-2 border-b border-zinc-100 pb-3 mb-4">
          <div className="flex items-center gap-2">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
              Filter Queue
            </h3>
            {hasActiveFilters && (
              <span className="badge-pending">Filtered</span>
            )}
            {!loading && (
              <span className="pill-chip font-mono">
                {total} {total === 1 ? "entry" : "entries"}
              </span>
            )}
          </div>
          {hasActiveFilters && (
            <button
              type="button"
              onClick={handleClearFilters}
              className="text-xs font-medium text-brand-600 hover:text-brand-700 hover:underline"
            >
              Reset filters
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <label className="block text-xs font-medium text-zinc-500 mb-1">
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
            <label className="block text-xs font-medium text-zinc-500 mb-1">
              College
            </label>
            <input
              type="text"
              placeholder="Search college name..."
              value={college}
              onChange={(e) => setCollege(e.target.value)}
              className="field-input text-xs"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-zinc-500 mb-1">
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
            <label className="block text-xs font-medium text-zinc-500 mb-1">
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
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-zinc-200 bg-zinc-50/80 px-3.5 py-2">
          <label className="flex items-center gap-2 text-xs font-medium text-zinc-700 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={isAllSelected}
              onChange={handleToggleSelectAll}
              aria-label="Select all registrations on this page"
              className="h-4 w-4 rounded border-zinc-300 text-brand-600 focus:ring-brand-500"
            />
            Select All ({items.length})
          </label>

          {selectedIds.size > 0 && (
            <div className="flex items-center gap-2">
              <span className="font-mono text-xs font-medium text-brand-700">
                {selectedIds.size} selected
              </span>
              <button
                type="button"
                onClick={handleBulkApprove}
                disabled={isBulkBusy}
                className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1 text-xs font-medium text-white shadow-subtle hover:bg-emerald-700 disabled:opacity-50 transition focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
              >
                <CheckCircle2 size={13} aria-hidden="true" />
                {isBulkBusy ? "Approving..." : `Approve (${selectedIds.size})`}
              </button>
              <button
                type="button"
                onClick={openBulkRejectModal}
                disabled={isBulkBusy}
                className="inline-flex items-center gap-1.5 rounded-lg bg-rose-600 px-3 py-1 text-xs font-medium text-white shadow-subtle hover:bg-rose-700 disabled:opacity-50 transition focus:outline-none focus:ring-2 focus:ring-rose-500/40"
              >
                <XCircle size={13} aria-hidden="true" />
                {isBulkBusy ? "Rejecting..." : `Reject (${selectedIds.size})`}
              </button>
              <button
                type="button"
                onClick={() => setSelectedIds(new Set())}
                className="text-xs text-zinc-500 hover:text-zinc-800"
              >
                Deselect
              </button>
            </div>
          )}
        </div>
      )}

      {/* Pending Items List or Empty State */}
      {loading ? (
        <div className="mt-3 space-y-3">
          {[1, 2, 3].map((n) => (
            <div
              key={n}
              className="surface-card p-4 sm:p-5 animate-pulse flex flex-col sm:flex-row justify-between gap-4"
            >
              <div className="space-y-2 flex-1">
                <div className="h-4 bg-zinc-200 rounded w-1/3" />
                <div className="h-3 bg-zinc-100 rounded w-1/2" />
                <div className="h-3 bg-zinc-100 rounded w-1/4" />
              </div>
              <div className="h-20 w-20 bg-zinc-200 rounded-lg shrink-0" />
            </div>
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="surface-card mt-3 p-10 text-center">
          <Inbox size={32} className="mx-auto mb-2 text-zinc-400" aria-hidden="true" />
          <p className="text-sm font-semibold text-zinc-900">
            {hasActiveFilters
              ? "No pending registrations match your active filters."
              : "Queue is empty — all registrations reviewed!"}
          </p>
          <p className="mt-1 text-xs text-zinc-500 max-w-sm mx-auto">
            {hasActiveFilters
              ? "Try adjusting or clearing your date/college filters above."
              : "New registration submissions with UPI payment proofs will appear here in real-time."}
          </p>
        </div>
      ) : (
        <div className="mt-3 space-y-3">
          {items.map((r) => {
            const isSelected = selectedIds.has(r._id);
            return (
              <div
                key={r._id}
                className={`surface-card p-4 sm:p-5 transition ${
                  isSelected
                    ? "border-brand-500/60 bg-brand-50/20 ring-1 ring-brand-500/30"
                    : "hover:border-zinc-300"
                }`}
              >
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  <div className="flex items-start gap-3 min-w-0">
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => handleToggleSelect(r._id)}
                      aria-label={`Select registration for ${r.studentName}`}
                      className="mt-1 h-4 w-4 rounded border-zinc-300 text-brand-600 focus:ring-brand-500 cursor-pointer"
                    />
                    <div className="min-w-0 text-sm">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-semibold text-zinc-900">
                          {r.studentName}
                        </span>
                        <StatusIcon status="pending" size={13} />
                        {r.event.fee !== undefined &&
                          r.amount !== undefined &&
                          r.amount !== r.event.fee && (
                            <span className="badge-rejected inline-flex items-center gap-1">
                              <AlertTriangle size={12} aria-hidden="true" />
                              <span>Amount Mismatch (₹{r.amount} vs expected ₹{r.event.fee})</span>
                            </span>
                          )}
                      </div>
                      <p className="mt-1 text-xs font-medium text-zinc-700">
                        {r.event.name}
                      </p>
                      <p className="mt-0.5 text-xs text-zinc-500">
                        {r.college || "—"} · {r.studentPhone || r.studentEmail}
                      </p>
                      <div className="mt-1.5 flex flex-wrap items-center gap-2 text-xs">
                        <span className="font-mono font-semibold text-zinc-900 bg-zinc-100 rounded px-1.5 py-0.5">
                          ₹{r.amount ?? 0}
                        </span>
                        <span className="font-mono text-zinc-500 text-[11px]">
                          {r.referralCode ? `Ref: ${r.referralCode}` : "Direct submission"}
                        </span>
                        {r.utr && (
                          <span className="font-mono text-zinc-500 text-[11px]">
                            UTR: <strong className="text-zinc-700">{r.utr}</strong>
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => setZoomed(r.paymentScreenshot)}
                    aria-label={`Inspect payment screenshot for ${r.studentName}`}
                    className="relative h-20 w-20 shrink-0 cursor-pointer overflow-hidden rounded-lg border border-zinc-200 shadow-subtle group hover:border-zinc-400 transition"
                  >
                    <Image
                      src={r.paymentScreenshot}
                      alt="UPI screenshot"
                      fill
                      sizes="80px"
                      loading="lazy"
                      className="object-cover group-hover:scale-105 transition duration-200"
                    />
                    <div className="absolute inset-0 bg-zinc-950/50 opacity-0 group-hover:opacity-100 transition flex items-center justify-center text-white text-[10px] font-medium gap-1">
                      <ZoomIn size={14} aria-hidden="true" />
                      <span>Inspect</span>
                    </div>
                  </button>
                </div>

                <div className="mt-3.5 pt-3 border-t border-zinc-100 flex flex-col gap-2 sm:flex-row">
                  <button
                    disabled={busyId === r._id || isBulkBusy}
                    onClick={() => handleApprove(r._id)}
                    className="btn-primary flex-1 py-1.5 text-xs font-medium inline-flex items-center justify-center gap-1.5"
                  >
                    <CheckCircle2 size={14} aria-hidden="true" />
                    <span>{busyId === r._id ? "Approving..." : "Approve Registration"}</span>
                  </button>
                  <button
                    disabled={busyId === r._id || isBulkBusy}
                    onClick={() => openRejectModal(r._id)}
                    className="btn-secondary flex-1 py-1.5 text-xs font-medium text-rose-600 hover:bg-rose-50 hover:border-rose-200 inline-flex items-center justify-center gap-1.5"
                  >
                    <XCircle size={14} aria-hidden="true" />
                    <span>Reject</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Pagination Controls */}
      {!loading && totalPages > 1 && (
        <div className="mt-5 flex items-center justify-between gap-4">
          <p className="text-xs text-zinc-500">
            Page <span className="font-mono font-semibold text-zinc-900">{page}</span> of{" "}
            <span className="font-mono font-semibold text-zinc-900">{totalPages}</span>
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={() => handlePageChange(page - 1)}
              disabled={page <= 1}
              className="btn-secondary py-1 px-3 text-xs disabled:opacity-40 inline-flex items-center gap-1"
            >
              <ChevronLeft size={14} aria-hidden="true" />
              <span>Previous</span>
            </button>
            <button
              onClick={() => handlePageChange(page + 1)}
              disabled={page >= totalPages}
              className="btn-secondary py-1 px-3 text-xs disabled:opacity-40 inline-flex items-center gap-1"
            >
              <span>Next</span>
              <ChevronRight size={14} aria-hidden="true" />
            </button>
          </div>
        </div>
      )}

      {/* Rejection Modal Dialog */}
      {rejectModal.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/60 p-4 backdrop-blur-sm">
          <div className="surface-card w-full max-w-md p-6 space-y-4 shadow-popover">
            <div>
              <h3 className="text-base font-bold text-zinc-900">
                {rejectModal.isBulk
                  ? `Reject ${selectedIds.size} Selected Registrations`
                  : "Reject Registration"}
              </h3>
              <p className="text-xs text-zinc-500 mt-1">
                Provide a reason for rejection. This note will appear on the student&apos;s status ticket.
              </p>
            </div>

            <div className="space-y-2">
              <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-500">
                Rejection Reason
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
                    className="rounded border border-zinc-200 bg-zinc-50 px-2 py-0.5 text-[11px] text-zinc-600 hover:bg-zinc-100 transition"
                  >
                    {chip}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex gap-2 justify-end pt-2 border-t border-zinc-100">
              <button
                type="button"
                onClick={() =>
                  setRejectModal({ isOpen: false, isBulk: false, targetId: null })
                }
                className="btn-secondary py-1.5 px-3 text-xs"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmRejection}
                className="inline-flex items-center justify-center rounded-lg bg-rose-600 px-3.5 py-1.5 text-xs font-medium text-white shadow-subtle hover:bg-rose-700 transition"
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
          className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/80 p-4 sm:p-6 cursor-pointer backdrop-blur-sm"
          onClick={() => setZoomed(null)}
        >
          <div className="relative h-[min(90vh,760px)] w-[min(90vw,760px)] overflow-hidden rounded-xl border border-zinc-700 bg-zinc-900 shadow-2xl">
            <Image
              src={zoomed}
              alt="UPI screenshot full size"
              fill
              sizes="(max-width: 760px) 90vw, 760px"
              priority
              className="object-contain"
            />
          </div>
        </div>
      )}
    </>
  );
}
