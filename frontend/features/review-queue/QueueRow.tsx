import { useState } from "react";
import Image from "next/image";
import {
  AlertTriangle,
  CheckCircle2,
  RefreshCw,
  XCircle,
  ZoomIn,
  Clock,
  Users,
} from "@/lib/icons";
import StatusIcon from "@/components/icons/StatusIcon";
import type { PendingRegistration } from "./review-queue.types";

interface QueueRowProps {
  registration: PendingRegistration;
  isSelected: boolean;
  isBusy: boolean;
  isBulkBusy: boolean;
  approveError?: string | null; // EVENT_FULL or other per-row approve error
  onToggleSelect: (id: string) => void;
  onApprove: (id: string) => void;
  onOpenRejectModal: (id: string) => void;
  onOpenCorrectionModal: (id: string) => void;
  onZoom: (url: string) => void;
}

/**
 * Returns a human-readable capacity badge: "47 / 100 seats", "FULL", or null for unlimited.
 */
function CapacityChip({
  capacity,
  approvedCount,
}: {
  capacity?: number | null;
  approvedCount?: number;
}) {
  if (capacity === null || capacity === undefined) return null;

  const count = approvedCount ?? 0;
  const isFull = count >= capacity;
  const remaining = Math.max(0, capacity - count);

  if (isFull) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-rose-100 border border-rose-200 px-2 py-0.5 text-[10px] font-bold text-rose-700 uppercase tracking-wider">
      <Users size={10} className="shrink-0" aria-hidden="true" />
      FULL
      </span>
    );
  }

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold ${
        remaining <= 5
          ? "bg-amber-50 border-amber-200 text-amber-700"
          : "bg-zinc-100 border-zinc-200 text-zinc-600"
      }`}
    >
      <Users size={10} className="shrink-0" aria-hidden="true" />
      {count} / {capacity} seats
    </span>
  );
}

export function QueueRow({
  registration: r,
  isSelected,
  isBusy,
  isBulkBusy,
  approveError,
  onToggleSelect,
  onApprove,
  onOpenRejectModal,
  onOpenCorrectionModal,
  onZoom,
}: QueueRowProps) {
  const isActionDisabled = isBusy || isBulkBusy;
  const currentStatus = r.status || "pending";
  const [showHistory, setShowHistory] = useState(false);

  const capacity = r.event?.capacity;
  const approvedCount = r.event?.approvedCount ?? 0;
  const isFull = capacity !== null && capacity !== undefined && approvedCount >= capacity;

  return (
    <div
      className={`surface-card min-w-0 p-4 transition sm:p-5 ${
        isSelected
          ? "border-brand-500/60 bg-brand-50/20 ring-1 ring-brand-500/30"
          : "hover:border-zinc-300"
      }`}
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 flex-1 items-start gap-3">
          <input
            type="checkbox"
            checked={isSelected}
            onChange={() => onToggleSelect(r._id)}
            aria-label={`Select registration for ${r.studentName}`}
            className="mt-0.5 h-5 w-5 shrink-0 cursor-pointer rounded border-zinc-300 text-brand-600 focus:ring-brand-500"
          />
          <div className="min-w-0 text-sm flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="min-w-0 break-words font-semibold text-zinc-900">{r.studentName}</span>
              <StatusIcon status={currentStatus} size={13} />
              {r.event.fee !== undefined &&
                r.amount !== undefined &&
                r.amount !== r.event.fee && (
                  <span className="badge-rejected inline-flex items-center gap-1">
                    <AlertTriangle size={12} aria-hidden="true" />
                    <span className="min-w-0">
                      Amount Mismatch (₹{r.amount} vs expected ₹{r.event.fee})
                    </span>
                  </span>
                )}
            </div>

            <div className="mt-1 flex flex-wrap items-center gap-2">
              <p className="min-w-0 break-words text-xs font-medium text-zinc-700">{r.event.name}</p>
              {/* Capacity chip — always visible per row */}
              <CapacityChip capacity={capacity} approvedCount={approvedCount} />
            </div>

            <p className="mt-0.5 min-w-0 break-all text-xs text-zinc-500">
              {r.college || "—"} · {r.studentPhone || r.studentEmail}
            </p>

            <div className="mt-1.5 flex flex-wrap items-center gap-2 text-xs">
              <span className="font-mono font-semibold text-zinc-900 bg-zinc-100 rounded px-1.5 py-0.5">
                ₹{r.amount ?? 0}
              </span>
              <span className="min-w-0 break-all font-mono text-[11px] text-zinc-500">
                {r.referralCode ? `Ref: ${r.referralCode}` : "Direct submission"}
              </span>
              {r.utr && (
                <span className="min-w-0 break-all font-mono text-[11px] text-zinc-500">
                  UTR: <strong className="text-zinc-700">{r.utr}</strong>
                </span>
              )}
            </div>

            {/* Correction note */}
            {r.correctionNote && (
              <div className="mt-2 rounded-md border border-amber-200 bg-amber-50/80 p-2.5 text-xs text-amber-900 space-y-0.5 font-sans">
                <span className="font-bold text-[10px] uppercase tracking-wider text-amber-800 flex items-center gap-1">
                  <AlertTriangle size={12} className="shrink-0" aria-hidden="true" />
                  Correction Requested Note:
                </span>
                <p className="break-words font-medium text-amber-900">{r.correctionNote}</p>
              </div>
            )}

            {/* EVENT_FULL inline error */}
            {approveError && (
              <div className="mt-2 rounded-md border border-rose-200 bg-rose-50 p-2.5 text-xs text-rose-800 flex items-start gap-1.5 font-sans">
                <AlertTriangle size={12} className="mt-0.5 shrink-0" aria-hidden="true" />
                <span className="font-semibold">{approveError}</span>
              </div>
            )}

            {/* History timeline */}
            {Array.isArray(r.history) && r.history.length > 1 && (
              <div className="mt-2">
                <button
                  type="button"
                  onClick={() => setShowHistory(!showHistory)}
                  className="inline-flex min-h-8 items-center gap-1 text-[11px] font-mono text-brand-600 hover:underline focus:outline-none focus:ring-2 focus:ring-brand-500/20"
                >
                  <Clock size={12} className="shrink-0" aria-hidden="true" />
                  <span>
                    {showHistory
                      ? "Hide History Log"
                      : `View History Log (${r.history.length} events)`}
                  </span>
                </button>

                {showHistory && (
                  <div className="mt-2 rounded-lg border border-zinc-200 bg-zinc-50/70 p-3 space-y-2 text-xs font-mono">
                    <div className="font-bold uppercase tracking-wider text-[10px] text-zinc-500">
                      Audit & Correction Timeline
                    </div>
                    {r.history.map((h, idx) => (
                      <div
                        key={idx}
                        className="border-l-2 border-brand-400 pl-2.5 py-1 space-y-0.5"
                      >
                        <div className="flex flex-col gap-0.5 text-zinc-700 font-semibold sm:flex-row sm:justify-between">
                          <span className="capitalize">{h.action.replace("_", " ")}</span>
                          <span className="text-[10px] text-zinc-400">
                            {new Date(h.timestamp).toLocaleString()}
                          </span>
                        </div>
                        {h.performedBy && (
                          <div className="text-[11px] text-zinc-500">
                            Actor: {h.performedBy}
                          </div>
                        )}
                        {h.note && (
                          <div className="text-[11px] text-zinc-600 font-sans font-medium bg-white p-1 rounded border border-zinc-200 mt-1">
                            &quot;{h.note}&quot;
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        <button
          type="button"
          onClick={() => onZoom(r.paymentScreenshot)}
          aria-label={`Inspect payment screenshot for ${r.studentName}`}
          className="group relative h-20 w-20 shrink-0 cursor-pointer overflow-hidden rounded-lg border border-zinc-200 shadow-subtle transition hover:border-zinc-400 focus:outline-none focus:ring-2 focus:ring-brand-500/30"
        >
          <Image
            src={r.paymentScreenshot}
            alt="UPI screenshot"
            width={80}
            height={80}
            loading="lazy"
            className="h-full w-full object-cover group-hover:scale-105 transition duration-200"
          />
          <div className="absolute inset-0 bg-zinc-950/50 opacity-0 group-hover:opacity-100 transition flex items-center justify-center text-white text-[10px] font-medium gap-1">
            <ZoomIn size={14} aria-hidden="true" />
            <span>Inspect</span>
          </div>
        </button>
      </div>

      {/* Review Action Buttons */}
      <div className="mt-3.5 grid grid-cols-1 gap-2 border-t border-zinc-100 pt-3 min-[420px]:grid-cols-3">
        {/* Approve — disabled and titled when event is full */}
        <button
          disabled={isActionDisabled || isFull}
          onClick={() => onApprove(r._id)}
          title={isFull ? "Event has reached maximum capacity" : undefined}
          className={`inline-flex min-h-10 items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold transition ${
            isFull
              ? "bg-zinc-100 border border-zinc-200 text-zinc-400 cursor-not-allowed"
              : "btn-primary"
          }`}
        >
          {isBusy ? (
            <>
              <RefreshCw size={14} className="shrink-0 animate-spin" aria-hidden="true" />
              <span>Approving...</span>
            </>
          ) : isFull ? (
            <>
              <Users size={14} className="shrink-0" aria-hidden="true" />
              <span>Event Full</span>
            </>
          ) : (
            <>
              <CheckCircle2 size={14} className="shrink-0" aria-hidden="true" />
              <span>Approve</span>
            </>
          )}
        </button>

        <button
          disabled={isActionDisabled}
          onClick={() => onOpenCorrectionModal(r._id)}
          className="inline-flex min-h-10 items-center justify-center gap-1.5 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-center text-xs font-semibold text-amber-800 shadow-subtle transition hover:bg-amber-100 focus:outline-none focus:ring-2 focus:ring-amber-500/30 disabled:opacity-50"
        >
          <RefreshCw size={14} className="shrink-0" aria-hidden="true" />
          <span>Request Correction</span>
        </button>

        <button
          disabled={isActionDisabled}
          onClick={() => onOpenRejectModal(r._id)}
          className="btn-secondary px-3 py-2 text-xs font-semibold text-rose-600 hover:bg-rose-50 hover:border-rose-200"
        >
          <XCircle size={14} className="shrink-0" aria-hidden="true" />
          <span>Reject</span>
        </button>
      </div>
    </div>
  );
}
