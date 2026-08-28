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
    <div className="mt-5 flex items-center justify-between gap-4">
      <p className="text-xs text-zinc-500">
        Page <span className="font-mono font-semibold text-zinc-900">{page}</span> of{" "}
        <span className="font-mono font-semibold text-zinc-900">{totalPages}</span>
      </p>
      <div className="flex items-center gap-2">
        <button
          onClick={() => onPageChange(page - 1)}
          disabled={page <= 1}
          className="btn-secondary py-1 px-3 text-xs disabled:opacity-40 inline-flex items-center gap-1"
        >
          <ChevronLeft size={14} aria-hidden="true" />
          <span>Previous</span>
        </button>
        <button
          onClick={() => onPageChange(page + 1)}
          disabled={page >= totalPages}
          className="btn-secondary py-1 px-3 text-xs disabled:opacity-40 inline-flex items-center gap-1"
        >
          <span>Next</span>
          <ChevronRight size={14} aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}
