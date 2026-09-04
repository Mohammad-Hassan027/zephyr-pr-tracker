import { CheckCircle2, XCircle } from "@/lib/icons";

interface BulkActionBarProps {
  itemCount: number;
  selectedCount: number;
  isAllSelected: boolean;
  isBulkBusy: boolean;
  loading: boolean;
  onToggleSelectAll: () => void;
  onBulkApprove: () => void;
  onBulkReject: () => void;
  onDeselectAll: () => void;
}

export function BulkActionBar({
  itemCount,
  selectedCount,
  isAllSelected,
  isBulkBusy,
  loading,
  onToggleSelectAll,
  onBulkApprove,
  onBulkReject,
  onDeselectAll,
}: BulkActionBarProps) {
  if (loading || itemCount === 0) return null;

  return (
    <div className="mt-3 flex flex-col gap-3 rounded-lg border border-zinc-200 bg-zinc-50/80 px-3.5 py-3 sm:flex-row sm:items-center sm:justify-between">
      <label className="flex min-h-10 items-center gap-2 text-xs font-medium text-zinc-700 cursor-pointer select-none">
        <input
          type="checkbox"
          checked={isAllSelected}
          onChange={onToggleSelectAll}
          aria-label="Select all registrations on this page"
          className="h-5 w-5 shrink-0 rounded border-zinc-300 text-brand-600 focus:ring-brand-500"
        />
        Select All ({itemCount})
      </label>

      {selectedCount > 0 && (
        <div className="flex flex-col gap-2 min-[420px]:flex-row min-[420px]:items-center">
          <span className="font-mono text-xs font-medium text-brand-700 min-[420px]:mr-1">
            {selectedCount} selected
          </span>
          <button
            type="button"
            onClick={onBulkApprove}
            disabled={isBulkBusy}
            className="inline-flex min-h-10 w-full min-[420px]:w-auto items-center justify-center gap-1.5 rounded-lg bg-emerald-600 px-3.5 py-2 text-xs font-medium text-white shadow-subtle transition hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-500/40 disabled:opacity-50"
          >
            <CheckCircle2 size={13} className="shrink-0" aria-hidden="true" />
            {isBulkBusy ? "Approving..." : `Approve (${selectedCount})`}
          </button>
          <button
            type="button"
            onClick={onBulkReject}
            disabled={isBulkBusy}
            className="inline-flex min-h-10 w-full min-[420px]:w-auto items-center justify-center gap-1.5 rounded-lg bg-rose-600 px-3.5 py-2 text-xs font-medium text-white shadow-subtle transition hover:bg-rose-700 focus:outline-none focus:ring-2 focus:ring-rose-500/40 disabled:opacity-50"
          >
            <XCircle size={13} className="shrink-0" aria-hidden="true" />
            {isBulkBusy ? "Rejecting..." : `Reject (${selectedCount})`}
          </button>
          <button
            type="button"
            onClick={onDeselectAll}
            className="min-h-10 w-full min-[420px]:w-auto rounded-lg px-2 py-2 text-xs text-zinc-500 hover:text-zinc-800 focus:outline-none focus:ring-2 focus:ring-zinc-900/10 text-center"
          >
            Deselect
          </button>
        </div>
      )}
    </div>
  );
}
