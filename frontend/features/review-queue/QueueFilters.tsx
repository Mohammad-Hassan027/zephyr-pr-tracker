import type { EventItem } from "./review-queue.types";

interface QueueFiltersProps {
  events: EventItem[];
  eventSlug: string;
  college: string;
  statusFilter: string;
  from: string;
  to: string;
  total: number;
  loading: boolean;
  hasActiveFilters: boolean;
  onEventChange: (slug: string) => void;
  onCollegeChange: (college: string) => void;
  onStatusChange: (status: string) => void;
  onFromChange: (from: string) => void;
  onToChange: (to: string) => void;
  onClearFilters: () => void;
}

export function QueueFilters({
  events,
  eventSlug,
  college,
  statusFilter,
  from,
  to,
  total,
  loading,
  hasActiveFilters,
  onEventChange,
  onCollegeChange,
  onStatusChange,
  onFromChange,
  onToChange,
  onClearFilters,
}: QueueFiltersProps) {
  return (
    <div className="surface-card mt-4 p-4 sm:p-5">
      <div className="mb-4 flex flex-col gap-2 border-b border-zinc-100 pb-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
            Filter Queue
          </h3>
          {hasActiveFilters && <span className="badge-pending">Filtered</span>}
          {!loading && (
            <span className="pill-chip font-mono">
              {total} {total === 1 ? "entry" : "entries"}
            </span>
          )}
        </div>
        {hasActiveFilters && (
          <button
            type="button"
            onClick={onClearFilters}
            className="min-h-8 self-start text-xs font-medium text-brand-600 hover:text-brand-700 hover:underline focus:outline-none focus:ring-2 focus:ring-brand-500/20"
          >
            Reset filters
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <div>
          <label className="block text-xs font-medium text-zinc-500 mb-1">
            Workflow Status
          </label>
          <select
            value={statusFilter}
            onChange={(e) => onStatusChange(e.target.value)}
            className="field-input text-xs"
          >
            <option value="">All Workflow Queue</option>
            <option value="pending">Pending Review</option>
            <option value="resubmitted">Resubmitted</option>
            <option value="needs_correction">Needs Correction</option>
          </select>
        </div>

        <div>
          <label className="block text-xs font-medium text-zinc-500 mb-1">
            Event
          </label>
          <select
            value={eventSlug}
            onChange={(e) => onEventChange(e.target.value)}
            className="field-input text-xs"
          >
            <option value="">All Events</option>
            {events.map((ev) => (
              <option key={ev._id} value={ev.slug}>
                {ev.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs font-medium text-zinc-500 mb-1">
            College
          </label>
          <input
            type="text"
            placeholder="Search college name..."
            value={college}
            onChange={(e) => onCollegeChange(e.target.value)}
            className="field-input text-xs"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-zinc-500 mb-1">
            From Date
          </label>
          <input
            type="date"
            value={from}
            onChange={(e) => onFromChange(e.target.value)}
            className="field-input text-xs"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-zinc-500 mb-1">
            To Date
          </label>
          <input
            type="date"
            value={to}
            onChange={(e) => onToChange(e.target.value)}
            className="field-input text-xs"
          />
        </div>
      </div>
    </div>
  );
}
