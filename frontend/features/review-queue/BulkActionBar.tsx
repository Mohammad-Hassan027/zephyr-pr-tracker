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
    <div className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-zinc-200 bg-zinc-50/80 px-3.5 py-2">
      <label className="flex items-center gap-2 text-xs font-medium text-zinc-700 cursor-pointer select-none">
        <input
          type="checkbox"
          checked={isAllSelected}
          onChange={onToggleSelectAll}
          aria-label="Select all registrations on this page"
          className="h-4 w-4 rounded border-zinc-300 text-brand-600 focus:ring-brand-500"
        />
        Select All ({itemCount})
      </label>

      {selectedCount > 0 && (
        <div className="flex items-center gap-2">
          <span className="font-mono text-xs font-medium text-brand-700">
            {selectedCount} selected
          </span>
          <button
            type="button"
            onClick={onBulkApprove}
            disabled={isBulkBusy}
            className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1 text-xs font-medium text-white shadow-subtle hover:bg-emerald-700 disabled:opacity-50 transition focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
          >
            <CheckCircle2 size={13} aria-hidden="true" />
            {isBulkBusy ? "Approving..." : `Approve (${selectedCount})`}
          </button>
          <button
            type="button"
            onClick={onBulkReject}
            disabled={isBulkBusy}
            className="inline-flex items-center gap-1.5 rounded-lg bg-rose-600 px-3 py-1 text-xs font-medium text-white shadow-subtle hover:bg-rose-700 disabled:opacity-50 transition focus:outline-none focus:ring-2 focus:ring-rose-500/40"
          >
            <XCircle size={13} aria-hidden="true" />
            {isBulkBusy ? "Rejecting..." : `Reject (${selectedCount})`}
          </button>
          <button
            type="button"
            onClick={onDeselectAll}
            className="text-xs text-zinc-500 hover:text-zinc-800"
          >
            Deselect
          </button>
        </div>
      )}
    </div>
  );
}
