import { Calendar, MapPin } from "@/lib/icons";
import type { EventItem } from "./admin-dashboard.types";

interface AdminLeaderboardProps {
  events: EventItem[];
  stats: Record<string, number>;
  eventForm: {
    name: string;
    slug: string;
    description: string;
    venue: string;
    fee: string;
    date: string;
    capacity: string;
  };
  onEventFormChange: (form: any) => void;
  onCreateEvent: (e: React.FormEvent) => void;
  onOpenEditEvent: (ev: EventItem) => void;
  onDeleteEvent: (id?: string, name?: string) => void;
}

export function AdminLeaderboard({
  events,
  stats,
  eventForm,
  onEventFormChange,
  onCreateEvent,
  onOpenEditEvent,
  onDeleteEvent,
}: AdminLeaderboardProps) {
  return (
    <section className="surface-card space-y-6 p-4 sm:p-6">
      <div>
        <div className="flex items-center justify-between border-b border-zinc-100 pb-3">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-zinc-900">
            Publish New Event
          </h2>
        </div>

        <form onSubmit={onCreateEvent} className="mt-4 grid gap-3 sm:grid-cols-2">
          <input
            required
            placeholder="Event Title (e.g. Coding War)"
            className="field-input text-xs"
            value={eventForm.name}
            onChange={(e) =>
              onEventFormChange({ ...eventForm, name: e.target.value })
            }
          />
          <input
            required
            placeholder="Slug (e.g. coding-war)"
            className="field-input text-xs font-mono"
            value={eventForm.slug}
            onChange={(e) =>
              onEventFormChange({ ...eventForm, slug: e.target.value })
            }
          />
          <input
            type="number"
            placeholder="Registration Fee in ₹ (0 if free)"
            className="field-input text-xs font-mono"
            value={eventForm.fee}
            onChange={(e) =>
              onEventFormChange({ ...eventForm, fee: e.target.value })
            }
          />
          <input
            placeholder="Venue / Location (e.g. Audi 2 / Online)"
            className="field-input text-xs"
            value={eventForm.venue}
            onChange={(e) =>
              onEventFormChange({ ...eventForm, venue: e.target.value })
            }
          />
          <input
            type="date"
            className="field-input text-xs font-mono"
            value={eventForm.date}
            onChange={(e) =>
              onEventFormChange({ ...eventForm, date: e.target.value })
            }
          />
          <input
            type="number"
            placeholder="Seat Capacity (leave empty for unlimited)"
            className="field-input text-xs font-mono"
            value={eventForm.capacity}
            onChange={(e) =>
              onEventFormChange({ ...eventForm, capacity: e.target.value })
            }
          />
          <textarea
            placeholder="Event summary & rules (optional)"
            rows={2}
            className="field-input text-xs sm:col-span-2"
            value={eventForm.description}
            onChange={(e) =>
              onEventFormChange({ ...eventForm, description: e.target.value })
            }
          />
          <button className="btn-primary sm:col-span-2 py-2 text-xs font-medium">
            + Create Event
          </button>
        </form>
      </div>

      <div className="border-t border-zinc-100 pt-5">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
            Active Events &amp; Capacities ({events.length})
          </h3>
        </div>

        {events.length === 0 ? (
          <div className="rounded-lg border border-dashed border-zinc-200 p-6 text-center text-xs text-zinc-400">
            No events created yet. Use the form above to publish your first event.
          </div>
        ) : (
          <div className="space-y-3">
            {events.map((e) => {
              const registeredCount = stats[e.slug] ?? (e._id ? stats[e._id] : 0) ?? 0;
              const capacity = e.capacity || null;
              const fillPercent = capacity
                ? Math.min(100, Math.round((registeredCount / capacity) * 100))
                : null;

              return (
                <div
                  key={e.slug}
                  className="rounded-lg border border-zinc-200 bg-zinc-50/60 p-4 space-y-3 transition hover:border-zinc-300"
                >
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="min-w-0 break-words font-sans text-sm font-bold text-zinc-900">{e.name}</span>
                        <span className="min-w-0 break-all font-mono text-[11px] text-zinc-400">
                          /{e.slug}
                        </span>
                      </div>
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1 text-xs text-zinc-500 font-mono">
                        <span className="rounded border border-brand-200/60 bg-brand-50 px-1.5 py-0.5 font-semibold text-brand-700">
                          {e.fee ? `₹${e.fee}` : "Free"}
                        </span>
                        {e.venue && (
                          <span className="inline-flex min-w-0 items-center gap-1">
                            <MapPin size={11} className="shrink-0" aria-hidden="true" />
                            <span className="min-w-0 break-words">{e.venue}</span>
                          </span>
                        )}
                        {e.date && (
                          <span className="inline-flex items-center gap-1">
                            <Calendar size={11} className="shrink-0" aria-hidden="true" />
                            <span>{new Date(e.date).toLocaleDateString()}</span>
                          </span>
                        )}
                      </div>
                      {e.description && (
                        <p className="mt-1 text-xs text-zinc-500 max-w-xl font-sans line-clamp-2">
                          {e.description}
                        </p>
                      )}
                    </div>

                    <div className="grid grid-cols-2 gap-2 sm:flex sm:shrink-0 sm:items-center">
                      <button
                        type="button"
                        onClick={() => onOpenEditEvent(e)}
                        className="btn-secondary px-2.5 py-2 text-xs"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => onDeleteEvent(e._id, e.name)}
                        className="inline-flex min-h-10 items-center justify-center rounded-lg border border-rose-200 bg-white px-2.5 py-2 text-xs font-medium text-rose-600 transition hover:bg-rose-50 focus:outline-none focus:ring-2 focus:ring-rose-500/20"
                      >
                        Delete
                      </button>
                    </div>
                  </div>

                  {/* Capacity Progress Bar */}
                  <div className="rounded-lg border border-zinc-200/80 bg-white p-3">
                    <div className="mb-1.5 flex flex-col gap-1 text-xs font-mono min-[420px]:flex-row min-[420px]:items-center min-[420px]:justify-between">
                      <span className="min-w-0 break-words text-zinc-600">
                        Registrations:{" "}
                        <strong className="text-zinc-900">{registeredCount}</strong>
                        {capacity ? ` / ${capacity}` : " (Unlimited)"}
                      </span>
                      {fillPercent !== null && (
                        <span
                          className={`font-semibold ${
                            fillPercent >= 90
                              ? "text-rose-600"
                              : fillPercent >= 70
                              ? "text-amber-600"
                              : "text-emerald-600"
                          }`}
                        >
                          {fillPercent}% capacity
                        </span>
                      )}
                    </div>
                    {capacity && (
                      <div className="h-1.5 w-full overflow-hidden rounded-full bg-zinc-100">
                        <div
                          className={`h-full transition-all duration-500 ${
                            fillPercent! >= 90
                              ? "bg-rose-500"
                              : fillPercent! >= 70
                              ? "bg-amber-500"
                              : "bg-brand-600"
                          }`}
                          style={{ width: `${fillPercent}%` }}
                        />
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}
