import type { EventItem } from "./review-queue.types";

interface QueueFiltersProps {
  events: EventItem[];
  eventSlug: string;
  college: string;
  from: string;
  to: string;
  total: number;
  loading: boolean;
  hasActiveFilters: boolean;
  onEventChange: (slug: string) => void;
  onCollegeChange: (college: string) => void;
  onFromChange: (from: string) => void;
  onToChange: (to: string) => void;
  onClearFilters: () => void;
}

export function QueueFilters({
  events,
  eventSlug,
  college,
  from,
  to,
  total,
  loading,
  hasActiveFilters,
  onEventChange,
  onCollegeChange,
  onFromChange,
  onToChange,
  onClearFilters,
}: QueueFiltersProps) {
  return (
    <div className="surface-card mt-4 p-4 sm:p-5">
      <div className="flex items-center justify-between gap-2 border-b border-zinc-100 pb-3 mb-4">
        <div className="flex items-center gap-2">
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
            className="text-xs font-medium text-brand-600 hover:text-brand-700 hover:underline"
          >
            Reset filters
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
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
