import { ChevronLeft, ChevronRight } from "@/lib/icons";

interface QueuePaginationProps {
  page: number;
  totalPages: number;
  loading: boolean;
  onPageChange: (page: number) => void;
}

export function QueuePagination({
  page,
  totalPages,
  loading,
  onPageChange,
}: QueuePaginationProps) {
  if (loading || totalPages <= 1) return null;

  return (
    <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
      <p className="text-xs text-zinc-500">
        Page <span className="font-mono font-semibold text-zinc-900">{page}</span> of{" "}
        <span className="font-mono font-semibold text-zinc-900">{totalPages}</span>
      </p>
      <div className="grid grid-cols-2 gap-2 sm:flex sm:items-center">
        <button
          onClick={() => onPageChange(page - 1)}
          disabled={page <= 1}
          className="btn-secondary px-3 py-2 text-xs disabled:opacity-40"
        >
          <ChevronLeft size={14} className="shrink-0" aria-hidden="true" />
          <span>Previous</span>
        </button>
        <button
          onClick={() => onPageChange(page + 1)}
          disabled={page >= totalPages}
          className="btn-secondary px-3 py-2 text-xs disabled:opacity-40"
        >
          <span>Next</span>
          <ChevronRight size={14} className="shrink-0" aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}
