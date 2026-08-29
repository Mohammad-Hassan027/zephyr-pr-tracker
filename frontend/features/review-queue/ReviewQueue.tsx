"use client";

import Image from "next/image";
import { useReviewQueue } from "./useReviewQueue";
import { QueueFilters } from "./QueueFilters";
import { QueueTable } from "./QueueTable";
import { QueuePagination } from "./QueuePagination";
import { ReviewDialog } from "./ReviewDialog";

export function ReviewQueue({ code }: { code?: string }) {
  const {
    items,
    events,
    busyId,
    isBulkBusy,
    zoomed,
    loading,
    selectedIds,
    dialogModal,
    noteText,
    approveErrors,
    page,
    totalPages,
    total,
    eventSlug,
    college,
    statusFilter,
    from,
    to,
    hasActiveFilters,
    isAllSelected,
    setZoomed,
    setDialogModal,
    setNoteText,
    setEventSlug,
    setCollege,
    setStatusFilter,
    setFrom,
    setTo,
    handleToggleSelect,
    handleToggleSelectAll,
    handleApprove,
    openRejectModal,
    openCorrectionModal,
    openBulkRejectModal,
    confirmDialog,
    handleBulkApprove,
    handlePageChange,
    handleClearFilters,
    setSelectedIds,
  } = useReviewQueue(code);

  return (
    <>
      <QueueFilters
        events={events}
        eventSlug={eventSlug}
        college={college}
        statusFilter={statusFilter}
        from={from}
        to={to}
        total={total}
        loading={loading}
        hasActiveFilters={hasActiveFilters}
        onEventChange={setEventSlug}
        onCollegeChange={setCollege}
        onStatusChange={setStatusFilter}
        onFromChange={setFrom}
        onToChange={setTo}
        onClearFilters={handleClearFilters}
      />

      <QueueTable
        items={items}
        loading={loading}
        hasActiveFilters={hasActiveFilters}
        selectedIds={selectedIds}
        busyId={busyId}
        isBulkBusy={isBulkBusy}
        isAllSelected={isAllSelected}
        selectedCount={selectedIds.size}
        approveErrors={approveErrors}
        onToggleSelect={handleToggleSelect}
        onToggleSelectAll={handleToggleSelectAll}
        onApprove={handleApprove}
        onOpenRejectModal={openRejectModal}
        onOpenCorrectionModal={openCorrectionModal}
        onZoom={setZoomed}
        onBulkApprove={handleBulkApprove}
        onBulkReject={openBulkRejectModal}
        onDeselectAll={() => setSelectedIds(new Set())}
      />

      <QueuePagination
        page={page}
        totalPages={totalPages}
        loading={loading}
        onPageChange={handlePageChange}
      />

      <ReviewDialog
        dialogModal={dialogModal}
        selectedCount={selectedIds.size}
        noteText={noteText}
        onNoteChange={setNoteText}
        onCancel={() => setDialogModal({ isOpen: false, mode: "reject", isBulk: false, targetId: null })}
        onConfirm={confirmDialog}
      />

      {/* Screenshot Zoom Lightbox */}
      {zoomed && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/80 p-4 sm:p-6 cursor-pointer backdrop-blur-sm"
          onClick={() => setZoomed(null)}
        >
          <div
            className="relative overflow-hidden rounded-xl border border-zinc-700 bg-zinc-900 shadow-2xl"
            style={{ height: "min(90vh, 760px)", width: "min(90vw, 760px)" }}
          >
            <Image
              src={zoomed}
              alt="UPI screenshot full size"
              fill
              sizes="(max-width: 760px) 90vw, 760px"
              priority
              className="object-contain"
            />
          </div>
        </div>
      )}
    </>
  );
}

export default ReviewQueue;
