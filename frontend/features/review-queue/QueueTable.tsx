import { Inbox } from "@/lib/icons";
import type { PendingRegistration } from "./review-queue.types";
import { QueueRow } from "./QueueRow";
import { BulkActionBar } from "./BulkActionBar";

interface QueueTableProps {
  items: PendingRegistration[];
  loading: boolean;
  hasActiveFilters: boolean;
  selectedIds: Set<string>;
  busyId: string | null;
  isBulkBusy: boolean;
  isAllSelected: boolean;
  selectedCount: number;
  approveErrors: Record<string, string>; // per-registration approve error messages
  onToggleSelect: (id: string) => void;
  onToggleSelectAll: () => void;
  onApprove: (id: string) => void;
  onOpenRejectModal: (id: string) => void;
  onOpenCorrectionModal: (id: string) => void;
  onZoom: (url: string) => void;
  onBulkApprove: () => void;
  onBulkReject: () => void;
  onDeselectAll: () => void;
}

export function QueueTable({
  items,
  loading,
  hasActiveFilters,
  selectedIds,
  busyId,
  isBulkBusy,
  isAllSelected,
  selectedCount,
  approveErrors,
  onToggleSelect,
  onToggleSelectAll,
  onApprove,
  onOpenRejectModal,
  onOpenCorrectionModal,
  onZoom,
  onBulkApprove,
  onBulkReject,
  onDeselectAll,
}: QueueTableProps) {
  if (loading) {
    return (
      <div className="mt-3 space-y-3">
        {[1, 2, 3].map((n) => (
          <div
            key={n}
            className="surface-card p-4 sm:p-5 animate-pulse flex flex-col sm:flex-row justify-between gap-4"
          >
            <div className="space-y-2 flex-1">
              <div className="h-4 bg-zinc-200 rounded w-1/3" />
              <div className="h-3 bg-zinc-100 rounded w-1/2" />
              <div className="h-3 bg-zinc-100 rounded w-1/4" />
            </div>
            <div className="h-20 w-20 bg-zinc-200 rounded-lg shrink-0" />
          </div>
        ))}
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="surface-card mt-3 p-6 text-center sm:p-10">
        <Inbox size={32} className="mx-auto mb-2 text-zinc-400" aria-hidden="true" />
        <p className="text-sm font-semibold text-zinc-900">
          {hasActiveFilters
            ? "No registrations match your active filters."
            : "Queue is empty — all registrations reviewed!"}
        </p>
        <p className="mt-1 text-xs text-zinc-500 max-w-sm mx-auto">
          {hasActiveFilters
            ? "Try adjusting or clearing your status/event/college filters above."
            : "New registration submissions and resubmissions will appear here in real-time."}
        </p>
      </div>
    );
  }

  return (
    <div className="mt-3 space-y-3">
      <BulkActionBar
        itemCount={items.length}
        selectedCount={selectedCount}
        isAllSelected={isAllSelected}
        isBulkBusy={isBulkBusy}
        loading={false}
        onToggleSelectAll={onToggleSelectAll}
        onBulkApprove={onBulkApprove}
        onBulkReject={onBulkReject}
        onDeselectAll={onDeselectAll}
      />
      {items.map((r) => (
        <QueueRow
          key={r._id}
          registration={r}
          isSelected={selectedIds.has(r._id)}
          isBusy={busyId === r._id}
          isBulkBusy={isBulkBusy}
          approveError={approveErrors[r._id] || null}
          onToggleSelect={onToggleSelect}
          onApprove={onApprove}
          onOpenRejectModal={onOpenRejectModal}
          onOpenCorrectionModal={onOpenCorrectionModal}
          onZoom={onZoom}
        />
      ))}
    </div>
  );
}
