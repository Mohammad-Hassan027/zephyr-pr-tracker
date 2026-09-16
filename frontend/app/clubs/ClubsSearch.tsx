"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Search, X, Calendar, MapPin } from "@/lib/icons";
import type { ClubDirectoryEntry } from "@/app/api/clubs-directory/route";

function formatEventDate(date: string | null) {
  if (!date) return null;
  const parsed = new Date(date);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

export default function ClubsSearch({
  initialClubs,
  totalEvents,
}: {
  initialClubs: ClubDirectoryEntry[];
  totalEvents: number;
}) {
  const [search, setSearch] = useState("");

  const filteredClubs = useMemo(() => {
    if (!search.trim()) return initialClubs;
    const q = search.toLowerCase();
    return initialClubs.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.slug.toLowerCase().includes(q) ||
        c.events.some(
          (e) =>
            e.title.toLowerCase().includes(q) ||
            (e.venue && e.venue.toLowerCase().includes(q)),
        ),
    );
  }, [initialClubs, search]);

  return (
    <>
      {/* Header Hero Section */}
      <section className="surface-card p-5 sm:p-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="pill-chip">Directory</span>
              <span className="font-mono text-xs text-zinc-400">
                {initialClubs.length} {initialClubs.length === 1 ? "club" : "clubs"} · {totalEvents} events
              </span>
            </div>
            <h1 className="page-title mt-2">Clubs &amp; Events</h1>
            <p className="page-subtitle">
              Explore active university clubs, browse upcoming fest competitions, and register with direct verification.
            </p>
          </div>

          {/* Instant Search Bar */}
          <div className="w-full sm:w-72 shrink-0">
            <div className="relative">
              <input
                type="text"
                placeholder="Search clubs or events..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="field-input text-xs pl-8"
              />
              <Search
                size={14}
                className="absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-400"
                aria-hidden="true"
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch("")}
                  aria-label="Clear search query"
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 transition"
                >
                  <X size={14} aria-hidden="true" />
                </button>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Bento Grid or Empty State */}
      {filteredClubs.length === 0 ? (
        <div className="surface-card p-8 text-center sm:p-12">
          <p className="text-base font-semibold text-zinc-900">
            {search ? "No matching clubs or events found" : "No live clubs registered yet"}
          </p>
          <p className="mt-1 text-xs text-zinc-500 max-w-sm mx-auto">
            {search
              ? `No results for "${search}". Try searching with different keywords.`
              : "Approved university clubs and their fests will appear here as soon as they go live."}
          </p>
          {search && (
            <button
              type="button"
              onClick={() => setSearch("")}
              className="btn-secondary mt-4 text-xs"
            >
              Clear Search
            </button>
          )}
        </div>
      ) : (
        <section className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredClubs.map((club, idx) => {
            const isLargeBento = idx === 0 && club.events.length >= 2;

            return (
              <article
                key={club.slug}
                className={`surface-card flex min-w-0 flex-col justify-between p-5 transition hover:border-zinc-300 hover:shadow-elevated sm:p-6 ${
                  isLargeBento ? "md:col-span-2" : ""
                }`}
              >
                <div>
                  <div className="flex flex-col gap-2 min-[420px]:flex-row min-[420px]:items-start min-[420px]:justify-between">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <h2 className="min-w-0 break-words font-sans text-lg font-bold tracking-tight text-zinc-900">
                          {club.name}
                        </h2>
                      </div>
                      <p className="mt-0.5 break-all font-mono text-[11px] text-zinc-400">
                        /register/{club.slug}
                      </p>
                    </div>
                    <span className="pill-chip self-start font-mono">
                      {club.events.length} {club.events.length === 1 ? "event" : "events"}
                    </span>
                  </div>

                  <div className="mt-5 space-y-2.5">
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400">
                      Event Schedule
                    </p>
                    {club.events.length === 0 ? (
                      <div className="rounded-lg border border-dashed border-zinc-200 p-4 text-center text-xs text-zinc-400">
                        No open events available right now.
                      </div>
                    ) : (
                      <div className={`grid gap-2 ${isLargeBento ? "sm:grid-cols-2" : "grid-cols-1"}`}>
                        {club.events.map((event) => {
                          const formattedDate = formatEventDate(event.date);
                          return (
                            <div
                              key={event.slug}
                              className="group min-w-0 rounded-lg border border-zinc-200/80 bg-zinc-50/70 p-3 text-xs transition hover:bg-white hover:border-zinc-300"
                            >
                              <div className="flex justify-between items-start gap-2">
                                <span className="min-w-0 break-words font-medium text-zinc-900">
                                  {event.title}
                                </span>
                                <span className="shrink-0 rounded border border-brand-200/60 bg-brand-50 px-1.5 py-0.5 font-mono font-semibold text-brand-700">
                                  {event.fee ? `₹${event.fee}` : "Free"}
                                </span>
                              </div>

                              <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-zinc-500 font-mono">
                                {formattedDate && (
                                  <span className="inline-flex items-center gap-1">
                                    <Calendar size={11} className="shrink-0" aria-hidden="true" />
                                    <span>{formattedDate}</span>
                                  </span>
                                )}
                                {event.venue && (
                                  <span className="inline-flex min-w-0 items-center gap-1">
                                    <MapPin size={11} className="shrink-0" aria-hidden="true" />
                                    <span className="min-w-0 break-words">{event.venue}</span>
                                  </span>
                                )}
                              </div>

                              {event.description && (
                                <p className="mt-1 text-[11px] text-zinc-500 line-clamp-2 leading-relaxed font-sans">
                                  {event.description}
                                </p>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>

                <div className="mt-6 flex flex-col gap-2 border-t border-zinc-100 pt-4 min-[420px]:flex-row min-[420px]:items-center min-[420px]:justify-between">
                  <Link
                    href={`/register?club=${encodeURIComponent(club.slug)}`}
                    className="inline-flex min-h-10 items-center text-xs font-medium text-zinc-500 transition hover:text-zinc-900 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
                  >
                    Quick selector →
                  </Link>
                  {club.events.length > 0 ? (
                    <Link
                      href={`/register/${encodeURIComponent(club.slug)}`}
                      className="btn-primary px-4 py-2 text-xs font-medium"
                    >
                      Register Now →
                    </Link>
                  ) : (
                    <span className="text-xs text-zinc-400 font-medium py-2">
                      No open registrations
                    </span>
                  )}
                </div>
              </article>
            );
          })}
        </section>
      )}
    </>
  );
}
