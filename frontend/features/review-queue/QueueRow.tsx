import { useState } from "react";
import Image from "next/image";
import { AlertTriangle, CheckCircle2, RefreshCw, XCircle, ZoomIn, Clock } from "@/lib/icons";
import StatusIcon from "@/components/icons/StatusIcon";
import type { PendingRegistration } from "./review-queue.types";

interface QueueRowProps {
  registration: PendingRegistration;
  isSelected: boolean;
  isBusy: boolean;
  isBulkBusy: boolean;
  onToggleSelect: (id: string) => void;
  onApprove: (id: string) => void;
  onOpenRejectModal: (id: string) => void;
  onOpenCorrectionModal: (id: string) => void;
  onZoom: (url: string) => void;
}

export function QueueRow({
  registration: r,
  isSelected,
  isBusy,
  isBulkBusy,
  onToggleSelect,
  onApprove,
  onOpenRejectModal,
  onOpenCorrectionModal,
  onZoom,
}: QueueRowProps) {
  const isActionDisabled = isBusy || isBulkBusy;
  const currentStatus = r.status || "pending";
  const [showHistory, setShowHistory] = useState(false);

  return (
    <div
      className={`surface-card p-4 sm:p-5 transition ${
        isSelected
          ? "border-brand-500/60 bg-brand-50/20 ring-1 ring-brand-500/30"
          : "hover:border-zinc-300"
      }`}
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-3 min-w-0 flex-1">
          <input
            type="checkbox"
            checked={isSelected}
            onChange={() => onToggleSelect(r._id)}
            aria-label={`Select registration for ${r.studentName}`}
            className="mt-1 h-4 w-4 rounded border-zinc-300 text-brand-600 focus:ring-brand-500 cursor-pointer"
          />
          <div className="min-w-0 text-sm flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-semibold text-zinc-900">
                {r.studentName}
              </span>
              <StatusIcon status={currentStatus} size={13} />
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

            {/* Display active Correction Note if in needs_correction or resubmitted */}
            {r.correctionNote && (
              <div className="mt-2 rounded.md border border-amber-200 bg-amber-50/80 p-2.5 text-xs text-amber-900 space-y-0.5 font-sans">
                <span className="font-bold text-[10px] uppercase tracking-wider text-amber-800 flex items-center gap-1">
                  <AlertTriangle size={12} />
                  Correction Requested Note:
                </span>
                <p className="font-medium text-amber-900">{r.correctionNote}</p>
              </div>
            )}

            {/* History timeline expander button */}
            {Array.isArray(r.history) && r.history.length > 1 && (
              <div className="mt-2">
                <button
                  type="button"
                  onClick={() => setShowHistory(!showHistory)}
                  className="text-[11px] font-mono text-brand-600 hover:underline inline-flex items-center gap-1"
                >
                  <Clock size={12} />
                  <span>{showHistory ? "Hide History Log" : `View History Log (${r.history.length} events)`}</span>
                </button>

                {showHistory && (
                  <div className="mt-2 rounded-lg border border-zinc-200 bg-zinc-50/70 p-3 space-y-2 text-xs font-mono">
                    <div className="font-bold uppercase tracking-wider text-[10px] text-zinc-500">
                      Audit & Correction Timeline
                    </div>
                    {r.history.map((h, idx) => (
                      <div key={idx} className="border-l-2 border-brand-400 pl-2.5 py-1 space-y-0.5">
                        <div className="flex justify-between text-zinc-700 font-semibold">
                          <span className="capitalize">{h.action.replace("_", " ")}</span>
                          <span className="text-[10px] text-zinc-400">
                            {new Date(h.timestamp).toLocaleString()}
                          </span>
                        </div>
                        {h.performedBy && (
                          <div className="text-[11px] text-zinc-500">Actor: {h.performedBy}</div>
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
          className="relative h-20 w-20 shrink-0 cursor-pointer overflow-hidden rounded-lg border border-zinc-200 shadow-subtle group hover:border-zinc-400 transition"
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
      <div className="mt-3.5 pt-3 border-t border-zinc-100 flex flex-wrap sm:flex-nowrap gap-2">
        <button
          disabled={isActionDisabled}
          onClick={() => onApprove(r._id)}
          className="btn-primary flex-1 py-2 text-xs font-semibold inline-flex items-center justify-center gap-1.5"
        >
          <CheckCircle2 size={14} aria-hidden="true" />
          <span>{isBusy ? "Approving..." : "Approve"}</span>
        </button>

        <button
          disabled={isActionDisabled}
          onClick={() => onOpenCorrectionModal(r._id)}
          className="inline-flex items-center justify-center rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-800 shadow-subtle hover:bg-amber-100 transition flex-1"
        >
          <RefreshCw size={14} aria-hidden="true" />
          <span>Request Correction</span>
        </button>

        <button
          disabled={isActionDisabled}
          onClick={() => onOpenRejectModal(r._id)}
          className="btn-secondary py-2 px-3 text-xs font-semibold text-rose-600 hover:bg-rose-50 hover:border-rose-200 inline-flex items-center justify-center gap-1.5"
        >
          <XCircle size={14} aria-hidden="true" />
          <span>Reject</span>
        </button>
      </div>
    </div>
  );
}
