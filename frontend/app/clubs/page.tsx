"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Header from "@/components/Header";
import { Search, X, Calendar, MapPin, ArrowRight } from "@/lib/icons";
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

export default function ClubsPage() {
  const [clubs, setClubs] = useState<ClubDirectoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");

  useEffect(() => {
    async function loadClubs() {
      setLoading(true);
      setError("");
      try {
        const res = await fetch("/api/clubs-directory", { cache: "no-store" });
        const data = await res.json();
        if (!res.ok) {
          setError(data.error || "Could not load clubs directory");
          return;
        }
        setClubs(Array.isArray(data) ? data : []);
      } catch (_err) {
        setError("Could not connect to the clubs directory");
      } finally {
        setLoading(false);
      }
    }

    loadClubs();
  }, []);

  const filteredClubs = useMemo(() => {
    if (!search.trim()) return clubs;
    const q = search.toLowerCase();
    return clubs.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.slug.toLowerCase().includes(q) ||
        c.events.some(
          (e) =>
            e.title.toLowerCase().includes(q) ||
            (e.venue && e.venue.toLowerCase().includes(q)),
        ),
    );
  }, [clubs, search]);

  const totalEvents = useMemo(() => {
    return clubs.reduce((acc, c) => acc + (c.events?.length || 0), 0);
  }, [clubs]);

  return (
    <>
      <Header />
      <main className="page-shell space-y-6">
        {/* Header Hero Section */}
        <section className="surface-card p-5 sm:p-8">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="pill-chip">Directory</span>
                <span className="font-mono text-xs text-zinc-400">
                  {clubs.length} {clubs.length === 1 ? "club" : "clubs"} · {totalEvents} events
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
                <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-400" aria-hidden="true" />
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

        {error && (
          <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-xs font-medium text-rose-700">
            {error}
          </div>
        )}

        {/* Bento Grid Architecture */}
        {loading ? (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3, 4, 5, 6].map((n) => (
              <div
                key={n}
                className="surface-card p-6 space-y-4 animate-pulse"
              >
                <div className="h-5 bg-zinc-200 rounded w-2/3" />
                <div className="h-4 bg-zinc-100 rounded w-1/3" />
                <div className="space-y-2 pt-2">
                  <div className="h-16 bg-zinc-100 rounded-lg" />
                  <div className="h-16 bg-zinc-100 rounded-lg" />
                </div>
                <div className="h-9 bg-zinc-200 rounded-lg pt-2" />
              </div>
            ))}
          </div>
        ) : filteredClubs.length === 0 ? (
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
                          No events listed yet. Check back soon.
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
                    <Link
                      href={`/register/${encodeURIComponent(club.slug)}`}
                      className="btn-primary px-4 py-2 text-xs font-medium"
                    >
                      Register Now →
                    </Link>
                  </div>
                </article>
              );
            })}
          </section>
        )}
      </main>
    </>
  );
}
