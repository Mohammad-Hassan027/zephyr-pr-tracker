"use client";

import { useEffect, useMemo, useState, useCallback, useRef } from "react";
import Image from "next/image";
import Header from "@/components/Header";
import { useDebouncedValue } from "@/lib/useDebouncedValue";

type AuditRegistration = {
  _id: string;
  regNo: string | null;
  studentName: string;
  studentEmail?: string;
  studentPhone?: string;
  college?: string;
  amount?: number;
  utr?: string;
  referralCode?: string | null;
  paymentScreenshot?: string;
  event: {
    name: string;
    slug?: string;
    venue?: string;
    fee?: number;
  };
  status: "approved" | "rejected";
  reviewedBy: string | null;
  rejectionReason: string | null;
  createdAt?: string;
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
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [selectedRecord, setSelectedRecord] = useState<AuditRegistration | null>(null);
  const [exporting, setExporting] = useState(false);

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
        if (fromDate) params.set("from", fromDate);
        if (toDate) params.set("to", toDate);

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
    [statusFilter, debouncedReviewerFilter, fromDate, toDate],
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

  // CSV Export Handler
  async function handleExportCsv() {
    setExporting(true);
    try {
      const params = new URLSearchParams();
      params.set("page", "1");
      params.set("limit", "1000"); // export up to 1000 matching records
      if (statusFilter !== "all") params.set("status", statusFilter);
      if (debouncedReviewerFilter.trim()) {
        params.set("reviewer", debouncedReviewerFilter.trim());
      }
      if (fromDate) params.set("from", fromDate);
      if (toDate) params.set("to", toDate);

      const res = await fetch(`/api/admin/registrations/audit?${params.toString()}`);
      if (!res.ok) throw new Error("Failed to export data");
      const data = await res.json();
      const items: AuditRegistration[] = data.items ?? data;

      if (!items.length) {
        alert("No records to export with current filters.");
        return;
      }

      const headers = [
        "Reg No",
        "Student Name",
        "Student Email",
        "Student Phone",
        "College",
        "Event",
        "Amount (INR)",
        "UTR / Ref",
        "Referral Code",
        "Status",
        "Reviewed By",
        "Rejection Reason",
        "Submitted At",
        "Reviewed At",
      ];

      const csvRows = [
        headers.join(","),
        ...items.map((r) =>
          [
            `"${r.regNo || ""}"`,
            `"${(r.studentName || "").replace(/"/g, '""')}"`,
            `"${(r.studentEmail || "").replace(/"/g, '""')}"`,
            `"${(r.studentPhone || "").replace(/"/g, '""')}"`,
            `"${(r.college || "").replace(/"/g, '""')}"`,
            `"${(r.event?.name || "").replace(/"/g, '""')}"`,
            r.amount ?? 0,
            `"${(r.utr || "").replace(/"/g, '""')}"`,
            `"${r.referralCode || ""}"`,
            `"${r.status}"`,
            `"${r.reviewedBy || ""}"`,
            `"${(r.rejectionReason || "").replace(/"/g, '""')}"`,
            `"${r.createdAt ? new Date(r.createdAt).toISOString() : ""}"`,
            `"${r.updatedAt ? new Date(r.updatedAt).toISOString() : ""}"`,
          ].join(","),
        ),
      ];

      const blob = new Blob([csvRows.join("\n")], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.setAttribute("href", url);
      link.setAttribute("download", `zephyr-audit-export-${new Date().toISOString().split("T")[0]}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err: any) {
      alert(err.message || "Failed to generate CSV export");
    } finally {
      setExporting(false);
    }
  }

  const hasActiveFilters = Boolean(
    statusFilter !== "all" || reviewerFilter || fromDate || toDate,
  );

  return (
    <>
      <Header showNav />
      <main className="page-shell space-y-6">
        <section className="surface-card p-6 sm:p-7">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <span className="pill-chip">Historical Ledger</span>
              <h1 className="page-title mt-2">Registration Audit Trail</h1>
              <p className="page-subtitle">
                Inspect historical verification decisions, reviewer notes, payment proofs, and export audit datasets.
              </p>
            </div>
            <button
              type="button"
              onClick={handleExportCsv}
              disabled={exporting || loading}
              className="btn-primary self-start sm:self-auto text-xs py-2 px-3.5 shrink-0 flex items-center gap-1.5"
            >
              <span>📥</span>
              <span>{exporting ? "Generating CSV..." : "Export CSV"}</span>
            </button>
          </div>
        </section>

        {/* Filters */}
        <section className="surface-card p-5 sm:p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-zinc-100 pb-4">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-900">
              {pagination ? `${pagination.total} Logged Registrations` : "Audit Records"}
            </h2>

            {hasActiveFilters && (
              <button
                onClick={() => {
                  setStatusFilter("all");
                  setReviewerFilter("");
                  setFromDate("");
                  setToDate("");
                }}
                className="text-xs font-medium text-brand-600 hover:underline"
              >
                Reset filters
              </button>
            )}
          </div>

          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <label className="block text-[10px] font-mono uppercase text-zinc-400 mb-1">
                Status
              </label>
              <select
                value={statusFilter}
                onChange={(e) =>
                  setStatusFilter(e.target.value as "all" | "approved" | "rejected")
                }
                className="field-input text-xs"
              >
                <option value="all">All Records</option>
                <option value="approved">Approved</option>
                <option value="rejected">Rejected</option>
              </select>
            </div>

            <div>
              <label className="block text-[10px] font-mono uppercase text-zinc-400 mb-1">
                Reviewer Code
              </label>
              <input
                type="text"
                placeholder="Filter code (e.g. AMAN12)"
                value={reviewerFilter}
                onChange={(e) => setReviewerFilter(e.target.value)}
                className="field-input text-xs font-mono uppercase"
                list="reviewer-list"
              />
              <datalist id="reviewer-list">
                {reviewerOptions.map((code) => (
                  <option key={code} value={code} />
                ))}
              </datalist>
            </div>

            <div>
              <label className="block text-[10px] font-mono uppercase text-zinc-400 mb-1">
                From Date
              </label>
              <input
                type="date"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
                className="field-input text-xs font-mono"
              />
            </div>

            <div>
              <label className="block text-[10px] font-mono uppercase text-zinc-400 mb-1">
                To Date
              </label>
              <input
                type="date"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
                className="field-input text-xs font-mono"
              />
            </div>
          </div>

          {/* Error Message */}
          {error && (
            <div className="mt-4 rounded-lg border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-xs font-medium text-rose-700">
              {error}
            </div>
          )}

          {/* Table */}
          <div className="mt-5 overflow-x-auto rounded-lg border border-zinc-200">
            {loading ? (
              <div className="flex flex-col items-center gap-2 p-10">
                <div className="h-6 w-6 animate-spin rounded-full border-2 border-brand-600 border-t-transparent" />
                <p className="text-xs text-zinc-400 font-mono">Loading audit logs…</p>
              </div>
            ) : registrations.length === 0 ? (
              <div className="p-8 text-center text-xs text-zinc-400 font-mono">
                No matching entries found for current filter criteria.
              </div>
            ) : (
              <table className="w-full text-left text-xs text-zinc-600">
                <thead className="border-b border-zinc-200 bg-zinc-50/80 text-[10px] font-mono uppercase tracking-wider text-zinc-400">
                  <tr>
                    <th className="px-3.5 py-2.5">Reg No</th>
                    <th className="px-3.5 py-2.5">Student</th>
                    <th className="px-3.5 py-2.5">Event</th>
                    <th className="px-3.5 py-2.5">Amount</th>
                    <th className="px-3.5 py-2.5">Status</th>
                    <th className="px-3.5 py-2.5">Reviewer</th>
                    <th className="px-3.5 py-2.5">Reviewed Date</th>
                    <th className="px-3.5 py-2.5 text-right">Details</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100 bg-white">
                  {registrations.map((item) => (
                    <tr
                      key={item._id}
                      onClick={() => setSelectedRecord(item)}
                      className="cursor-pointer transition hover:bg-zinc-50/80"
                    >
                      <td className="whitespace-nowrap px-3.5 py-2.5 font-mono font-bold text-zinc-900">
                        {item.regNo || "—"}
                      </td>
                      <td className="px-3.5 py-2.5">
                        <p className="font-medium text-zinc-900 font-sans">{item.studentName}</p>
                        <p className="text-[11px] text-zinc-400 font-mono">{item.college || item.studentEmail}</p>
                      </td>
                      <td className="px-3.5 py-2.5 font-medium text-zinc-800">{item.event?.name || "—"}</td>
                      <td className="whitespace-nowrap px-3.5 py-2.5 font-mono font-bold text-zinc-900">
                        ₹{item.amount ?? 0}
                      </td>
                      <td className="whitespace-nowrap px-3.5 py-2.5">
                        {item.status === "approved" ? (
                          <span className="badge-approved">
                            Approved
                          </span>
                        ) : (
                          <span className="badge-rejected">
                            Rejected
                          </span>
                        )}
                      </td>
                      <td className="whitespace-nowrap px-3.5 py-2.5 font-mono text-zinc-700">
                        {item.reviewedBy ? (
                          <span className="bg-zinc-100 border border-zinc-200/80 rounded px-1.5 py-0.5">
                            {item.reviewedBy}
                          </span>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td className="whitespace-nowrap px-3.5 py-2.5 font-mono text-[11px] text-zinc-500">
                        {item.updatedAt ? new Date(item.updatedAt).toLocaleDateString() : "—"}
                      </td>
                      <td className="whitespace-nowrap px-3.5 py-2.5 text-right font-medium text-brand-600 hover:underline">
                        View →
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* Pagination Controls */}
          {!loading && pagination && pagination.totalPages > 1 && (
            <div className="mt-4 flex items-center justify-between border-t border-zinc-100 pt-3">
              <p className="text-xs font-mono text-zinc-400">
                Page <span className="font-bold text-zinc-900">{pagination.page}</span> of{" "}
                <span className="font-bold text-zinc-900">{pagination.totalPages}</span>
              </p>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handlePageChange(page - 1)}
                  disabled={!pagination.hasPrevPage}
                  className="btn-secondary py-1 px-3 text-xs disabled:opacity-40"
                >
                  ← Prev
                </button>
                <button
                  onClick={() => handlePageChange(page + 1)}
                  disabled={!pagination.hasNextPage}
                  className="btn-secondary py-1 px-3 text-xs disabled:opacity-40"
                >
                  Next →
                </button>
              </div>
            </div>
          )}
        </section>

        {/* Drill-down Detail Modal */}
        {selectedRecord && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/50 p-4 backdrop-blur-sm">
            <div className="surface-card w-full max-w-2xl max-h-[90vh] overflow-y-auto p-6 shadow-elevated space-y-4">
              <div className="flex items-center justify-between border-b border-zinc-100 pb-3">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-base font-bold text-zinc-900 font-sans">
                      {selectedRecord.studentName}
                    </h3>
                    <span
                      className={
                        selectedRecord.status === "approved"
                          ? "badge-approved"
                          : "badge-rejected"
                      }
                    >
                      {selectedRecord.status === "approved" ? "Approved" : "Rejected"}
                    </span>
                  </div>
                  {selectedRecord.regNo && (
                    <p className="font-mono text-xs text-brand-700 font-semibold mt-0.5">
                      Reg No: {selectedRecord.regNo}
                    </p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedRecord(null)}
                  className="text-zinc-400 hover:text-zinc-600 text-xs"
                >
                  ✕
                </button>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 text-xs">
                <div className="space-y-2.5">
                  <div>
                    <span className="text-[10px] font-mono uppercase text-zinc-400">Event</span>
                    <p className="font-medium text-zinc-900 font-sans mt-0.5">{selectedRecord.event?.name}</p>
                  </div>
                  <div>
                    <span className="text-[10px] font-mono uppercase text-zinc-400">Email</span>
                    <p className="text-zinc-700 font-mono mt-0.5">{selectedRecord.studentEmail || "—"}</p>
                  </div>
                  <div>
                    <span className="text-[10px] font-mono uppercase text-zinc-400">Phone</span>
                    <p className="text-zinc-700 font-mono mt-0.5">{selectedRecord.studentPhone || "—"}</p>
                  </div>
                  <div>
                    <span className="text-[10px] font-mono uppercase text-zinc-400">College</span>
                    <p className="text-zinc-700 mt-0.5">{selectedRecord.college || "—"}</p>
                  </div>
                </div>

                <div className="space-y-2.5">
                  <div>
                    <span className="text-[10px] font-mono uppercase text-zinc-400">Amount Paid</span>
                    <p className="font-mono font-bold text-zinc-900 mt-0.5">₹{selectedRecord.amount ?? 0}</p>
                  </div>
                  <div>
                    <span className="text-[10px] font-mono uppercase text-zinc-400">UTR / Ref Number</span>
                    <p className="font-mono text-zinc-700 mt-0.5">{selectedRecord.utr || "—"}</p>
                  </div>
                  <div>
                    <span className="text-[10px] font-mono uppercase text-zinc-400">Referral Code</span>
                    <p className="font-mono text-zinc-700 mt-0.5">{selectedRecord.referralCode || "Direct (None)"}</p>
                  </div>
                  <div>
                    <span className="text-[10px] font-mono uppercase text-zinc-400">Reviewed By</span>
                    <p className="font-mono text-zinc-700 mt-0.5">{selectedRecord.reviewedBy || "—"}</p>
                  </div>
                </div>
              </div>

              {selectedRecord.rejectionReason && (
                <div className="rounded-lg border border-rose-200 bg-rose-50/80 p-3 text-xs text-rose-800">
                  <span className="font-bold uppercase tracking-wider text-[10px]">Rejection Reason:</span>{" "}
                  {selectedRecord.rejectionReason}
                </div>
              )}

              {selectedRecord.paymentScreenshot && (
                <div>
                  <span className="block text-[10px] font-mono uppercase text-zinc-400 mb-1.5">
                    Payment Verification Screenshot
                  </span>
                  <div className="relative h-64 w-full overflow-hidden rounded-lg border border-zinc-200 bg-zinc-900">
                    <Image
                      src={selectedRecord.paymentScreenshot}
                      alt="Payment screenshot"
                      fill
                      sizes="(max-width: 672px) 100vw, 672px"
                      className="object-contain"
                    />
                  </div>
                </div>
              )}

              <div className="flex justify-end pt-2 border-t border-zinc-100">
                <button
                  type="button"
                  onClick={() => setSelectedRecord(null)}
                  className="btn-secondary py-1.5 px-4 text-xs"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </>
  );
}
