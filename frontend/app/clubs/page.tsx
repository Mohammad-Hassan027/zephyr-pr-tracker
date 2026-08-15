"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Header from "@/components/Header";
import type { ClubDirectoryEntry } from "@/app/api/clubs-directory/route";

function formatEventDate(date: string | null) {
  if (!date) return null;
  const parsed = new Date(date);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export default function ClubsPage() {
  const [clubs, setClubs] = useState<ClubDirectoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadClubs() {
      setLoading(true);
      setError("");
      try {
        const res = await fetch("/api/clubs-directory", { cache: "no-store" });
        const data = await res.json();
        if (!res.ok) {
          setError(data.error || "Could not load clubs");
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

  return (
    <>
      <Header showNav />
      <main className="page-shell space-y-6">
        <section className="surface-card border-accent/20 bg-gradient-to-br from-accent/10 via-white to-accentAlt/10 p-5 sm:p-6">
          <p className="pill-chip">Discover</p>
          <h1 className="page-title mt-3">Clubs &amp; Events</h1>
          <p className="page-subtitle">
            Browse approved Zephyr clubs and their upcoming events, then register
            without needing a direct link from a PR member.
          </p>
        </section>

        {error && (
          <p className="rounded-2xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </p>
        )}

        {loading ? (
          <div className="surface-card p-8 text-center text-sm text-slate-500">
            Loading clubs...
          </div>
        ) : clubs.length === 0 ? (
          <div className="surface-card p-8 text-center">
            <p className="text-lg font-semibold text-ink">
              No clubs live yet — check back soon
            </p>
            <p className="mt-2 text-sm text-slate-600">
              Approved clubs will appear here with their events as soon as they
              go live on the platform.
            </p>
          </div>
        ) : (
          <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {clubs.map((club) => (
              <article
                key={club.slug}
                className="surface-card flex flex-col border-accent/15 bg-white/90 p-4 sm:p-5"
              >
                <h2 className="font-display text-lg font-semibold text-ink">
                  {club.name}
                </h2>

                <div className="mt-4 flex-1">
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                    Active events
                  </p>
                  {club.events.length === 0 ? (
                    <p className="mt-2 text-sm text-slate-500">
                      No events listed yet.
                    </p>
                  ) : (
                    <ul className="mt-2 space-y-2">
                      {club.events.map((event) => {
                        const formattedDate = formatEventDate(event.date);
                        return (
                          <li
                            key={event.slug}
                            className="rounded-2xl border border-slate-200/80 bg-slate-50/80 px-3 py-2 text-sm"
                          >
                            <p className="font-medium text-ink">{event.title}</p>
                            {formattedDate && (
                              <p className="mt-0.5 text-xs text-slate-500">
                                {formattedDate}
                              </p>
                            )}
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>

                <Link
                  href={`/register/${encodeURIComponent(club.slug)}`}
                  className="btn-primary mt-5 w-full"
                >
                  Register
                </Link>
              </article>
            ))}
          </section>
        )}
      </main>
    </>
  );
}
