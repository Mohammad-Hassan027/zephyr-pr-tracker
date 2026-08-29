import type { ReviewModalState } from "./review-queue.types";

interface ReviewDialogProps {
  dialogModal: ReviewModalState;
  selectedCount: number;
  noteText: string;
  onNoteChange: (text: string) => void;
  onCancel: () => void;
  onConfirm: () => void;
}

export function ReviewDialog({
  dialogModal,
  selectedCount,
  noteText,
  onNoteChange,
  onCancel,
  onConfirm,
}: ReviewDialogProps) {
  if (!dialogModal.isOpen) return null;

  const isCorrection = dialogModal.mode === "correction";

  const title = isCorrection
    ? "Request Correction from Contributor"
    : dialogModal.isBulk
    ? `Reject ${selectedCount} Selected Registrations`
    : "Reject Registration";

  const subtitle = isCorrection
    ? "Explain what needs to be fixed. The contributor will see this note on their status pass to resubmit."
    : "Provide a reason for rejection. This note will appear on the student's status ticket.";

  const label = isCorrection ? "Correction Note (Required)" : "Rejection Reason";

  const placeholder = isCorrection
    ? "e.g. UTR number is unreadable in screenshot. Please re-upload clearer image."
    : "e.g. UPI amount does not match event fee";

  const chips = isCorrection
    ? [
        "UTR number unreadable in screenshot",
        "Payment screenshot cropped or blurry",
        "Paid amount does not match event fee",
        "Please provide valid phone number",
      ]
    : [
        "Payment screenshot unreadable",
        "Incorrect payment amount",
        "Transaction ID not found",
        "Duplicate submission",
      ];

  const confirmBtnClass = isCorrection
    ? "inline-flex items-center justify-center rounded-lg bg-amber-600 px-3.5 py-1.5 text-xs font-semibold text-white shadow-subtle hover:bg-amber-700 transition"
    : "inline-flex items-center justify-center rounded-lg bg-rose-600 px-3.5 py-1.5 text-xs font-semibold text-white shadow-subtle hover:bg-rose-700 transition";

  const confirmBtnText = isCorrection ? "Send Correction Request" : "Confirm Rejection";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/60 p-4 backdrop-blur-sm">
      <div className="surface-card w-full max-w-md p-6 space-y-4 shadow-popover">
        <div>
          <h3 className="text-base font-bold text-zinc-900">{title}</h3>
          <p className="text-xs text-zinc-500 mt-1 leading-relaxed">{subtitle}</p>
        </div>

        <div className="space-y-2">
          <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-500">
            {label}
          </label>
          <textarea
            value={noteText}
            onChange={(e) => onNoteChange(e.target.value)}
            placeholder={placeholder}
            rows={3}
            className="field-input text-sm resize-none"
            autoFocus
          />

          <div className="flex flex-wrap gap-1.5 pt-1">
            {chips.map((chip) => (
              <button
                key={chip}
                type="button"
                onClick={() => onNoteChange(chip)}
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
            className={confirmBtnClass}
          >
            {confirmBtnText}
          </button>
        </div>
      </div>
    </div>
  );
}
