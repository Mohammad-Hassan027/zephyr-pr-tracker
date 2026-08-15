"use client";

import { useEffect, useMemo, useState, useCallback, useRef } from "react";
import Header from "@/components/Header";
import { useDebouncedValue } from "@/lib/useDebouncedValue";

type AuditRegistration = {
  _id: string;
  regNo: string | null;
  studentName: string;
  event: { name: string; slug?: string };
  status: "approved" | "rejected";
  reviewedBy: string | null;
  rejectionReason: string | null;
  updatedAt: string;
};

type Pagination = {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
};

const PAGE_LIMIT = 20;

export default function AuditPage() {
  const [registrations, setRegistrations] = useState<AuditRegistration[]>([]);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "approved" | "rejected">("all");
  const [reviewerFilter, setReviewerFilter] = useState("");
  const debouncedReviewerFilter = useDebouncedValue(reviewerFilter, 300);
  const [page, setPage] = useState(1);

  const fetchAbortRef = useRef<AbortController | null>(null);

  const fetchAudit = useCallback(
    async (targetPage: number, signal: AbortSignal) => {
      setLoading(true);
      setError("");
      try {
        const params = new URLSearchParams();
        params.set("page", String(targetPage));
        params.set("limit", String(PAGE_LIMIT));
        if (statusFilter !== "all") params.set("status", statusFilter);
        if (debouncedReviewerFilter.trim()) {
          params.set("reviewer", debouncedReviewerFilter.trim());
        }

        const res = await fetch(
          `/api/admin/registrations/audit?${params.toString()}`,
          { cache: "no-store", signal },
        );
        if (signal.aborted) return;
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.error || "Failed to load audit trail");
        }
        const data = await res.json();
        if (signal.aborted) return;
        setRegistrations(data.items ?? data);
        if (data.pagination) {
          setPagination(data.pagination);
          setPage(data.pagination.page);
        }
      } catch (err) {
        if (signal.aborted || (err instanceof DOMException && err.name === "AbortError")) {
          return;
        }
        setError(err instanceof Error ? err.message : "Error loading audit trail");
      } finally {
        if (!signal.aborted) {
          setLoading(false);
        }
      }
    },
    [statusFilter, debouncedReviewerFilter],
  );

  // Re-fetch from page 1 when filters change
  useEffect(() => {
    fetchAbortRef.current?.abort();
    const controller = new AbortController();
    fetchAbortRef.current = controller;
    setPage(1);
    fetchAudit(1, controller.signal);
    return () => controller.abort();
  }, [fetchAudit]);

  function handlePageChange(newPage: number) {
    if (!pagination) return;
    if (newPage < 1 || newPage > pagination.totalPages) return;
    fetchAbortRef.current?.abort();
    const controller = new AbortController();
    fetchAbortRef.current = controller;
    fetchAudit(newPage, controller.signal);
  }

  // Extract unique reviewer codes seen in current page for datalist
  const reviewerOptions = useMemo(() => {
    const set = new Set<string>();
    registrations.forEach((r) => {
      if (r.reviewedBy) set.add(r.reviewedBy);
    });
    return Array.from(set).sort();
  }, [registrations]);

  return (
    <>
      <Header showNav />
      <main className="page-shell space-y-6">
        <section className="surface-card border-accent/20 bg-gradient-to-br from-accent/10 via-white to-accentAlt/10 p-5 sm:p-6">
          <p className="pill-chip">Admin audit</p>
          <h1 className="page-title mt-3">Registration Audit Trail</h1>
          <p className="page-subtitle">
            Review historical decisions, track reviewer actions, and filter through approved and rejected submissions.
          </p>
        </section>

        {/* Filters */}
        <section className="surface-card p-5 sm:p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <h2 className="text-lg font-semibold text-ink">
              {pagination
                ? `${pagination.total} total entries`
                : "Audit Trail"}
            </h2>

            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Status:</span>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value as "all" | "approved" | "rejected")}
                  className="field-input w-36 py-1.5 text-sm"
                >
                  <option value="all">All Statuses</option>
                  <option value="approved">Approved</option>
                  <option value="rejected">Rejected</option>
                </select>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Reviewer:</span>
                <input
                  type="text"
                  placeholder="Filter by code (e.g. AMAN126)"
                  value={reviewerFilter}
                  onChange={(e) => setReviewerFilter(e.target.value)}
                  className="field-input w-48 py-1.5 text-sm"
                  list="reviewer-list"
                />
                <datalist id="reviewer-list">
                  {reviewerOptions.map((code) => (
                    <option key={code} value={code} />
                  ))}
                </datalist>
              </div>

              {(statusFilter !== "all" || reviewerFilter !== "") && (
                <button
                  onClick={() => {
                    setStatusFilter("all");
                    setReviewerFilter("");
                  }}
                  className="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-600 transition hover:bg-slate-200"
                >
                  Clear filters
                </button>
              )}
            </div>
          </div>

          {/* Error Message */}
          {error && (
            <p className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </p>
          )}

          {/* Table */}
          <div className="mt-5 overflow-x-auto">
            {loading ? (
              <div className="flex flex-col items-center gap-3 p-8">
                <div className="h-8 w-8 animate-spin rounded-full border-2 border-accent border-t-transparent" />
                <p className="text-sm text-slate-500">Loading audit trail…</p>
              </div>
            ) : registrations.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-200 p-8 text-center text-sm text-slate-500">
                No reviewed registrations found matching the current filters.
              </div>
            ) : (
              <table className="w-full text-left text-sm text-slate-600">
                <thead className="border-b border-slate-200 bg-slate-50/80 text-xs font-semibold uppercase tracking-wider text-slate-500">
                  <tr>
                    <th className="px-4 py-3">Reg No</th>
                    <th className="px-4 py-3">Student Name</th>
                    <th className="px-4 py-3">Event</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Reviewed By</th>
                    <th className="px-4 py-3">Rejection Reason</th>
                    <th className="px-4 py-3">Reviewed At</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {registrations.map((item) => (
                    <tr key={item._id} className="transition hover:bg-slate-50/50">
                      <td className="whitespace-nowrap px-4 py-3 font-mono font-medium text-ink">
                        {item.regNo || "—"}
                      </td>
                      <td className="px-4 py-3 font-medium text-ink">{item.studentName}</td>
                      <td className="px-4 py-3">{item.event?.name || "—"}</td>
                      <td className="whitespace-nowrap px-4 py-3">
                        {item.status === "approved" ? (
                          <span className="inline-flex items-center rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-medium text-emerald-700 ring-1 ring-inset ring-emerald-600/20">
                            Approved
                          </span>
                        ) : (
                          <span className="inline-flex items-center rounded-full bg-rose-50 px-2.5 py-0.5 text-xs font-medium text-rose-700 ring-1 ring-inset ring-rose-600/20">
                            Rejected
                          </span>
                        )}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 font-mono text-xs text-slate-600">
                        {item.reviewedBy || "—"}
                      </td>
                      <td className="max-w-xs truncate px-4 py-3 text-slate-500" title={item.rejectionReason || undefined}>
                        {item.rejectionReason || "—"}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-xs text-slate-500">
                        {item.updatedAt ? new Date(item.updatedAt).toLocaleString() : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* Pagination Controls */}
          {!loading && pagination && pagination.totalPages > 1 && (
            <div className="mt-5 flex items-center justify-between border-t border-slate-100 pt-4">
              <p className="text-xs text-slate-500">
                Page <span className="font-semibold text-ink">{pagination.page}</span> of{" "}
                <span className="font-semibold text-ink">{pagination.totalPages}</span>
              </p>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handlePageChange(page - 1)}
                  disabled={!pagination.hasPrevPage}
                  className="rounded-full border border-slate-200 bg-white px-4 py-1.5 text-xs font-semibold text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  ← Previous
                </button>
                <button
                  onClick={() => handlePageChange(page + 1)}
                  disabled={!pagination.hasNextPage}
                  className="rounded-full border border-slate-200 bg-white px-4 py-1.5 text-xs font-semibold text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Next →
                </button>
              </div>
            </div>
          )}
        </section>
      </main>
    </>
  );
}
