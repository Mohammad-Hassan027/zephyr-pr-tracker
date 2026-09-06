"use client";

import { useState } from "react";
import { Download, CheckCircle2, AlertTriangle, RefreshCw, X } from "@/lib/icons";
import { downloadExport, ExportType } from "@/lib/api/export";
import type { EventItem } from "./admin-dashboard.types";

interface AdminExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  events: EventItem[];
}

export function AdminExportModal({ isOpen, onClose, events }: AdminExportModalProps) {
  const [exportType, setExportType] = useState<ExportType>("all");
  const [eventSlug, setEventSlug] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [attendanceStatus, setAttendanceStatus] = useState("all");
  const [referralCode, setReferralCode] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [college, setCollege] = useState("");

  const [loading, setLoading] = useState(false);
  const [successMsg, setSuccessMsg] = useState("");
  const [errorMsg, setErrorMsg] = useState("");

  if (!isOpen) return null;

  async function handleExport(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setErrorMsg("");
    setSuccessMsg("");

    try {
      const result = await downloadExport(
        {
          type: exportType,
          event: eventSlug || undefined,
          status: statusFilter !== "all" ? statusFilter : undefined,
          attendanceStatus: attendanceStatus !== "all" ? attendanceStatus : undefined,
          code: referralCode.trim() || undefined,
          from: fromDate || undefined,
          to: toDate || undefined,
          college: college.trim() || undefined,
        },
        "admin",
      );

      setSuccessMsg(`Downloaded ${result.filename}`);
      setTimeout(() => {
        setSuccessMsg("");
      }, 4000);
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to generate export file.");
    } finally {
      setLoading(false);
    }
  }

  const isRegistrationType =
    exportType === "all" ||
    exportType === "approved" ||
    exportType === "pending" ||
    exportType === "rejected" ||
    exportType === "needs_correction" ||
    exportType === "attendance" ||
    exportType === "payment_reconciliation";

  return (
    <div
      className="modal-backdrop"
      role="dialog"
      aria-modal="true"
      aria-labelledby="export-dialog-title"
    >
      <div className="modal-panel max-w-xl space-y-4 shadow-elevated">
        {/* Header */}
        <div className="flex items-start justify-between gap-3 border-b border-zinc-100 pb-3">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-50 text-brand-600">
              <Download size={16} aria-hidden="true" />
            </div>
            <div>
              <h3 id="export-dialog-title" className="text-sm font-bold text-zinc-900">
                Export Club Data
              </h3>
              <p className="text-[11px] text-zinc-500 font-mono">
                Streamed RFC-4180 CSV with formula injection defense
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex min-h-8 min-w-8 shrink-0 items-center justify-center rounded-lg text-xs text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-zinc-900/10"
            aria-label="Close export dialog"
          >
            <X size={16} />
          </button>
        </div>

        <form onSubmit={handleExport} className="space-y-4">
          {/* Dataset / Type */}
          <div>
            <label className="block text-[10px] font-mono uppercase tracking-wider text-zinc-500 mb-1">
              Select Dataset Type
            </label>
            <select
              value={exportType}
              onChange={(e) => setExportType(e.target.value as ExportType)}
              className="field-input text-xs"
            >
              <option value="all">All Event Registrations</option>
              <option value="approved">Approved Registrations (Confirmed Seats)</option>
              <option value="pending">Pending & Resubmitted Queue</option>
              <option value="rejected">Rejected Registrations (With Reasons)</option>
              <option value="needs_correction">Correction-Requested Registrations</option>
              <option value="attendance">Attendance & Check-in Ledger</option>
              <option value="referral_performance">PR Referral Performance & Revenue</option>
              <option value="payment_reconciliation">Payment Reconciliation & UPI Ledger</option>
            </select>
          </div>

          {/* Filter Grid */}
          {isRegistrationType && (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {/* Event Filter */}
              <div>
                <label className="block text-[10px] font-mono uppercase tracking-wider text-zinc-500 mb-1">
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

              {/* Status Filter (if 'all' dataset) */}
              {exportType === "all" && (
                <div>
                  <label className="block text-[10px] font-mono uppercase tracking-wider text-zinc-500 mb-1">
                    Workflow Status
                  </label>
                  <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    className="field-input text-xs"
                  >
                    <option value="all">All Statuses</option>
                    <option value="approved">Approved</option>
                    <option value="pending">Pending</option>
                    <option value="resubmitted">Resubmitted</option>
                    <option value="needs_correction">Needs Correction</option>
                    <option value="rejected">Rejected</option>
                  </select>
                </div>
              )}

              {/* Attendance Status (if 'attendance' dataset) */}
              {exportType === "attendance" && (
                <div>
                  <label className="block text-[10px] font-mono uppercase tracking-wider text-zinc-500 mb-1">
                    Attendance Status
                  </label>
                  <select
                    value={attendanceStatus}
                    onChange={(e) => setAttendanceStatus(e.target.value)}
                    className="field-input text-xs"
                  >
                    <option value="all">All Records</option>
                    <option value="present">Present (Checked In)</option>
                    <option value="absent">Absent</option>
                    <option value="not_marked">Not Marked</option>
                  </select>
                </div>
              )}

              {/* Referral Code Filter */}
              <div>
                <label className="block text-[10px] font-mono uppercase tracking-wider text-zinc-500 mb-1">
                  Referral Code (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. RAHUL100"
                  value={referralCode}
                  onChange={(e) => setReferralCode(e.target.value)}
                  className="field-input text-xs font-mono uppercase"
                />
              </div>

              {/* College Filter */}
              <div>
                <label className="block text-[10px] font-mono uppercase tracking-wider text-zinc-500 mb-1">
                  College Search (Optional)
                </label>
                <input
                  type="text"
                  placeholder="Filter by college..."
                  value={college}
                  onChange={(e) => setCollege(e.target.value)}
                  className="field-input text-xs"
                />
              </div>
            </div>
          )}

          {/* Date Range */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="block text-[10px] font-mono uppercase tracking-wider text-zinc-500 mb-1">
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
              <label className="block text-[10px] font-mono uppercase tracking-wider text-zinc-500 mb-1">
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

          {/* Export Security & Format notice */}
          <div className="rounded-lg border border-zinc-200 bg-zinc-50/70 p-3 text-[11px] text-zinc-500">
            <span className="font-semibold text-zinc-700">Format:</span> UTF-8 CSV with Byte Order Mark (BOM). Values starting with formula operators (<code className="font-mono text-zinc-700">=, +, -, @</code>) are escaped for spreadsheet safety. Authentication tokens and private secrets are excluded.
          </div>

          {/* Alerts */}
          {errorMsg && (
            <div className="flex items-center gap-2 rounded-lg border border-rose-200 bg-rose-50 p-2.5 text-xs text-rose-700">
              <AlertTriangle size={14} className="shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {successMsg && (
            <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 p-2.5 text-xs text-emerald-700">
              <CheckCircle2 size={14} className="shrink-0" />
              <span>{successMsg}</span>
            </div>
          )}

          {/* Footer Actions */}
          <div className="flex flex-col-reverse gap-2 border-t border-zinc-100 pt-3 min-[400px]:flex-row min-[400px]:justify-end">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="btn-secondary px-3.5 py-2 text-xs"
            >
              Close
            </button>
            <button
              type="submit"
              disabled={loading}
              className="btn-primary px-4 py-2 text-xs font-medium"
            >
              {loading ? (
                <>
                  <RefreshCw size={14} className="animate-spin shrink-0" aria-hidden="true" />
                  <span>Generating Stream...</span>
                </>
              ) : (
                <>
                  <Download size={14} className="shrink-0" aria-hidden="true" />
                  <span>Download CSV</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default AdminExportModal;
