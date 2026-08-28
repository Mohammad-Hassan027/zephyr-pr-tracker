"use client";

import { useCallback, useEffect, useRef, useState } from "react";
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
import type { RejectModalState } from "./review-queue.types";

const PAGE_LIMIT = 20;

export function useReviewQueue(code?: string) {
  const [items, setItems] = useState<PendingRegistration[]>([]);
  const [events, setEvents] = useState<EventItem[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [isBulkBusy, setIsBulkBusy] = useState(false);
  const [zoomed, setZoomed] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Selection state
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Rejection modal state
  const [rejectModal, setRejectModal] = useState<RejectModalState>({
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
          signal
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
    [code, eventSlug, debouncedCollege, from, to]
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
    [fetchQueue, page]
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
          code
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
          rejectionReason || undefined
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

  return {
    items,
    events,
    busyId,
    isBulkBusy,
    zoomed,
    loading,
    selectedIds,
    rejectModal,
    rejectionReason,
    page,
    totalPages,
    total,
    eventSlug,
    college,
    from,
    to,
    hasActiveFilters,
    isAllSelected,
    setZoomed,
    setRejectModal,
    setRejectionReason,
    setEventSlug,
    setCollege,
    setFrom,
    setTo,
    handleToggleSelect,
    handleToggleSelectAll,
    handleApprove,
    openRejectModal,
    openBulkRejectModal,
    confirmRejection,
    handleBulkApprove,
    handlePageChange,
    handleClearFilters,
    setSelectedIds,
  };
}
