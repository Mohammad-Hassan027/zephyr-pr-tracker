import type { RejectModalState } from "./review-queue.types";

interface ReviewDialogProps {
  rejectModal: RejectModalState;
  selectedCount: number;
  rejectionReason: string;
  onRejectionReasonChange: (reason: string) => void;
  onCancel: () => void;
  onConfirm: () => void;
}

export function ReviewDialog({
  rejectModal,
  selectedCount,
  rejectionReason,
  onRejectionReasonChange,
  onCancel,
  onConfirm,
}: ReviewDialogProps) {
  if (!rejectModal.isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/60 p-4 backdrop-blur-sm">
      <div className="surface-card w-full max-w-md p-6 space-y-4 shadow-popover">
        <div>
          <h3 className="text-base font-bold text-zinc-900">
            {rejectModal.isBulk
              ? `Reject ${selectedCount} Selected Registrations`
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
            onChange={(e) => onRejectionReasonChange(e.target.value)}
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
                onClick={() => onRejectionReasonChange(chip)}
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
            onClick={onCancel}
            className="btn-secondary py-1.5 px-3 text-xs"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="inline-flex items-center justify-center rounded-lg bg-rose-600 px-3.5 py-1.5 text-xs font-medium text-white shadow-subtle hover:bg-rose-700 transition"
          >
            Confirm Rejection
          </button>
        </div>
      </div>
    </div>
  );
}
