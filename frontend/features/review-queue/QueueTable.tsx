import { Inbox } from "@/lib/icons";
import type { PendingRegistration } from "./review-queue.types";
import { QueueRow } from "./QueueRow";

interface QueueTableProps {
  items: PendingRegistration[];
  loading: boolean;
  hasActiveFilters: boolean;
  selectedIds: Set<string>;
  busyId: string | null;
  isBulkBusy: boolean;
  onToggleSelect: (id: string) => void;
  onApprove: (id: string) => void;
  onOpenRejectModal: (id: string) => void;
  onZoom: (url: string) => void;
}

export function QueueTable({
  items,
  loading,
  hasActiveFilters,
  selectedIds,
  busyId,
  isBulkBusy,
  onToggleSelect,
  onApprove,
  onOpenRejectModal,
  onZoom,
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
      <div className="surface-card mt-3 p-10 text-center">
        <Inbox size={32} className="mx-auto mb-2 text-zinc-400" aria-hidden="true" />
        <p className="text-sm font-semibold text-zinc-900">
          {hasActiveFilters
            ? "No pending registrations match your active filters."
            : "Queue is empty — all registrations reviewed!"}
        </p>
        <p className="mt-1 text-xs text-zinc-500 max-w-sm mx-auto">
          {hasActiveFilters
            ? "Try adjusting or clearing your date/college filters above."
            : "New registration submissions with UPI payment proofs will appear here in real-time."}
        </p>
      </div>
    );
  }

  return (
    <div className="mt-3 space-y-3">
      {items.map((r) => (
        <QueueRow
          key={r._id}
          registration={r}
          isSelected={selectedIds.has(r._id)}
          isBusy={busyId === r._id}
          isBulkBusy={isBulkBusy}
          onToggleSelect={onToggleSelect}
          onApprove={onApprove}
          onOpenRejectModal={onOpenRejectModal}
          onZoom={onZoom}
        />
      ))}
    </div>
  );
}
