"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { getEvents } from "@/lib/api/events";
import {
  approveRegistration,
  bulkApproveRegistrations,
  bulkRejectRegistrations,
  getPendingQueue,
  rejectRegistration,
  requestCorrection,
} from "@/lib/api/review-queue";
import type { EventItem, PendingRegistration } from "@/lib/api/types";
import { useDebouncedValue } from "@/lib/useDebouncedValue";
import type { ReviewModalState } from "./review-queue.types";

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

  // Review modal state (handles both rejection & correction request)
  const [dialogModal, setDialogModal] = useState<ReviewModalState>({
    isOpen: false,
    mode: "reject",
    isBulk: false,
    targetId: null,
  });
  const [noteText, setNoteText] = useState("");

  // History timeline view modal
  const [historyModalItem, setHistoryModalItem] = useState<PendingRegistration | null>(null);

  // Pagination state
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);

  // Filter state
  const [eventSlug, setEventSlug] = useState("");
  const [college, setCollege] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const debouncedCollege = useDebouncedValue(college, 300);

  const fetchAbortRef = useRef<AbortController | null>(null);

  // Keyboard accessibility: Escape to close modals
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setZoomed(null);
        setHistoryModalItem(null);
        if (dialogModal.isOpen) {
          setDialogModal({ isOpen: false, mode: "reject", isBulk: false, targetId: null });
        }
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [dialogModal.isOpen]);

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
            status: statusFilter || undefined,
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
    [code, eventSlug, debouncedCollege, statusFilter, from, to]
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
    setNoteText("Payment screenshot could not be verified");
    setDialogModal({
      isOpen: true,
      mode: "reject",
      isBulk: false,
      targetId: id,
    });
  }

  function openCorrectionModal(id: string) {
    setNoteText("UTR number is unreadable in screenshot. Please re-upload clearer image.");
    setDialogModal({
      isOpen: true,
      mode: "correction",
      isBulk: false,
      targetId: id,
    });
  }

  function openBulkRejectModal() {
    setNoteText("Payment screenshot could not be verified");
    setDialogModal({
      isOpen: true,
      mode: "reject",
      isBulk: true,
      targetId: null,
    });
  }

  async function confirmDialog() {
    if (dialogModal.mode === "correction" && dialogModal.targetId) {
      setBusyId(dialogModal.targetId);
      try {
        await requestCorrection(
          dialogModal.targetId,
          noteText || "Correction required",
          code
        );
        setDialogModal({ isOpen: false, mode: "reject", isBulk: false, targetId: null });
        await load(page);
      } finally {
        setBusyId(null);
      }
    } else if (dialogModal.isBulk) {
      setIsBulkBusy(true);
      try {
        await bulkRejectRegistrations(
          Array.from(selectedIds),
          noteText || undefined,
          code
        );
        setDialogModal({ isOpen: false, mode: "reject", isBulk: false, targetId: null });
        setSelectedIds(new Set());
        await load(page);
      } finally {
        setIsBulkBusy(false);
      }
    } else if (dialogModal.targetId) {
      setBusyId(dialogModal.targetId);
      try {
        await rejectRegistration(
          dialogModal.targetId,
          code,
          noteText || undefined
        );
        setDialogModal({ isOpen: false, mode: "reject", isBulk: false, targetId: null });
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

  const hasActiveFilters = Boolean(eventSlug || college || statusFilter || from || to);

  function handleClearFilters() {
    setEventSlug("");
    setCollege("");
    setStatusFilter("");
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
    dialogModal,
    noteText,
    historyModalItem,
    page,
    totalPages,
    total,
    eventSlug,
    college,
    statusFilter,
    from,
    to,
    hasActiveFilters,
    isAllSelected,
    setZoomed,
    setDialogModal,
    setNoteText,
    setHistoryModalItem,
    setEventSlug,
    setCollege,
    setStatusFilter,
    setFrom,
    setTo,
    handleToggleSelect,
    handleToggleSelectAll,
    handleApprove,
    openRejectModal,
    openCorrectionModal,
    openBulkRejectModal,
    confirmDialog,
    handleBulkApprove,
    handlePageChange,
    handleClearFilters,
    setSelectedIds,
  };
}
