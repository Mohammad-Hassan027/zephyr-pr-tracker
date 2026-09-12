"use client";

import { useEffect, useState } from "react";
import Header from "@/components/Header";
import { CheckInConsole } from "@/features/check-in/CheckInConsole";
import type { EventItem, PublicClub } from "@/lib/api/types";

export default function AdminCheckInPage() {
  const [events, setEvents] = useState<EventItem[]>([]);
  const [club, setClub] = useState<PublicClub | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadData() {
      try {
        const [eventsRes, clubRes] = await Promise.all([
          fetch("/api/admin/events", { cache: "no-store" }),
          fetch("/api/admin/club", { cache: "no-store" }),
        ]);

        if (eventsRes.ok) {
          const evData = await eventsRes.json();
          setEvents(Array.isArray(evData) ? evData : evData.events || []);
        }

        if (clubRes.ok) {
          const clubData = await clubRes.json();
          setClub(clubData.club || clubData);
        }
      } catch (err: any) {
        setError(err.message || "Failed to load events for check-in");
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, []);

  return (
    <>
      <Header showNav />
      <main className="page-shell space-y-6">
        {loading ? (
          <div className="surface-card flex flex-col items-center justify-center p-12 space-y-3">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-brand-600 border-t-transparent" />
            <p className="text-xs text-zinc-400 font-mono">Initializing check-in console…</p>
          </div>
        ) : error ? (
          <div className="surface-card border-rose-200 bg-rose-50 p-6 text-xs text-rose-800">
            <p className="font-bold text-sm">Failed to load check-in console</p>
            <p className="mt-1">{error}</p>
          </div>
        ) : (
          <CheckInConsole events={events} clubName={club?.name} />
        )}
      </main>
    </>
  );
}