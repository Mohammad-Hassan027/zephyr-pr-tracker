import Image from "next/image";
import { AlertTriangle, CheckCircle2, XCircle, ZoomIn } from "@/lib/icons";
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
  onZoom,
}: QueueRowProps) {
  const isActionDisabled = isBusy || isBulkBusy;

  return (
    <div
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
            onChange={() => onToggleSelect(r._id)}
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

      <div className="mt-3.5 pt-3 border-t border-zinc-100 flex gap-2">
        <button
          disabled={isActionDisabled}
          onClick={() => onApprove(r._id)}
          className="btn-primary flex-1 py-2.5 text-sm font-medium inline-flex items-center justify-center gap-1.5"
        >
          <CheckCircle2 size={14} aria-hidden="true" />
          <span>{isBusy ? "Approving..." : "Approve Registration"}</span>
        </button>
        <button
          disabled={isActionDisabled}
          onClick={() => onOpenRejectModal(r._id)}
          className="btn-secondary flex-1 py-2.5 text-sm font-medium text-rose-600 hover:bg-rose-50 hover:border-rose-200 inline-flex items-center justify-center gap-1.5"
        >
          <XCircle size={14} aria-hidden="true" />
          <span>Reject</span>
        </button>
      </div>
    </div>
  );
}
