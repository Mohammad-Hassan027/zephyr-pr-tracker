"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import Header from "@/components/Header";

type ClubDirectoryItem = {
  id: string;
  name: string;
  slug: string;
  events: Array<{
    id: string;
    name: string;
    slug: string;
    fee?: number;
    venue?: string;
    date?: string;
  }>;
};

export default function RegisterPage() {
  return (
    <Suspense
      fallback={
        <main className="mx-auto flex min-h-screen max-w-md items-center justify-center p-4 sm:p-6">
          <div className="surface-card w-full p-8 text-center animate-pulse">
            <div className="mx-auto mb-3 h-6 w-6 rounded-full border-2 border-brand-600 border-t-transparent animate-spin" />
            <p className="text-xs font-medium text-zinc-500">Loading portal…</p>
          </div>
        </main>
      }
    >
      <RegisterSelector />
    </Suspense>
  );
}

function RegisterSelector() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const clubSlug = searchParams.get("club") || searchParams.get("c");
  const refCode = searchParams.get("ref");
  const eventSlug = searchParams.get("event") || searchParams.get("e");

  const [clubs, setClubs] = useState<ClubDirectoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedClubSlug, setSelectedClubSlug] = useState("");
  const [selectedEventSlug, setSelectedEventSlug] = useState("");
  const [referralInput, setReferralInput] = useState(refCode || "");
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    if (clubSlug) {
      const params = new URLSearchParams();
      if (refCode) params.set("ref", refCode);
      if (eventSlug) params.set("event", eventSlug);
      const queryStr = params.toString();
      router.replace(`/register/${encodeURIComponent(clubSlug)}${queryStr ? `?${queryStr}` : ""}`);
    }
  }, [clubSlug, refCode, eventSlug, router]);

  useEffect(() => {
    if (!clubSlug) {
      fetch("/api/clubs-directory")
        .then((r) => (r.ok ? r.json() : []))
        .then((data) => {
          if (Array.isArray(data)) {
            setClubs(data);
            if (data.length > 0) {
              setSelectedClubSlug(data[0].slug);
            }
          }
        })
        .catch(() => setClubs([]))
        .finally(() => setLoading(false));
    }
  }, [clubSlug]);

  if (clubSlug) {
    return (
      <main className="mx-auto flex min-h-screen max-w-md items-center justify-center p-4 sm:p-6">
        <div className="surface-card w-full p-8 text-center">
          <span className="pill-chip">Redirecting</span>
          <h1 className="mt-3 text-lg font-bold text-zinc-900">
            Opening {clubSlug} registration...
          </h1>
        </div>
      </main>
    );
  }

  const filteredClubs = clubs.filter(
    (c) =>
      c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.slug.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.events.some((ev) => ev.name.toLowerCase().includes(searchQuery.toLowerCase())),
  );

  const currentClub = clubs.find((c) => c.slug === selectedClubSlug);

  function handleProceed(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedClubSlug) return;
    const params = new URLSearchParams();
    if (referralInput.trim()) params.set("ref", referralInput.trim().toUpperCase());
    if (selectedEventSlug) params.set("event", selectedEventSlug);
    const queryStr = params.toString();
    router.push(`/register/${encodeURIComponent(selectedClubSlug)}${queryStr ? `?${queryStr}` : ""}`);
  }

  return (
    <>
      <Header />
      <main className="page-shell max-w-2xl space-y-6 py-5 sm:py-10">
        <section className="surface-card p-5 sm:p-7">
          <div className="flex items-center gap-2">
            <span className="pill-chip">Quick Start</span>
          </div>
          <h1 className="page-title mt-2">Event Registration Selector</h1>
          <p className="page-subtitle">
            Choose your club and event, attach your PR referral code if you have one, and proceed to the verification form.
          </p>
        </section>

        <section className="surface-card space-y-5 p-5 sm:p-7">
          <form onSubmit={handleProceed} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-500 mb-1.5">
                1. Select University Club
              </label>
              <input
                type="text"
                placeholder="Filter clubs (e.g. ACM, Coding Club)..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="field-input text-xs mb-2"
              />

              {loading ? (
                <div className="p-6 text-center text-xs text-zinc-400">Loading clubs directory…</div>
              ) : filteredClubs.length === 0 ? (
                <div className="rounded-lg border border-dashed border-zinc-200 p-4 text-center text-xs text-zinc-400">
                  No matching clubs found.
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-48 overflow-y-auto p-1">
                  {filteredClubs.map((c) => (
                    <button
                      key={c.id || c.slug}
                      type="button"
                      onClick={() => {
                        setSelectedClubSlug(c.slug);
                        setSelectedEventSlug("");
                      }}
                      className={`min-h-20 rounded-lg border p-3 text-left transition focus:outline-none focus:ring-2 focus:ring-brand-500/20 ${
                        selectedClubSlug === c.slug
                          ? "border-brand-600 bg-brand-50/40 ring-1 ring-brand-600 text-zinc-900"
                          : "border-zinc-200 hover:border-zinc-300 bg-white text-zinc-700"
                      }`}
                    >
                      <p className="break-words text-sm font-semibold">{c.name}</p>
                      <p className="font-mono text-[11px] text-zinc-400 mt-0.5">
                        {c.events.length} {c.events.length === 1 ? "event" : "events"} available
                      </p>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {currentClub && (
              <div>
                <label className="block break-words text-xs font-semibold uppercase tracking-wider text-zinc-500 mb-1.5">
                  2. Select Event ({currentClub.name})
                </label>
                <select
                  value={selectedEventSlug}
                  onChange={(e) => setSelectedEventSlug(e.target.value)}
                  className="field-input text-xs"
                >
                  <option value="">Choose an event (or decide on next screen)</option>
                  {currentClub.events.map((ev) => (
                    <option key={ev.slug} value={ev.slug}>
                      {ev.name} {ev.fee !== undefined ? `(₹${ev.fee})` : ""}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-500 mb-1.5">
                3. PR Referral Code (Optional)
              </label>
              <input
                type="text"
                placeholder="e.g. AMAN126"
                value={referralInput}
                onChange={(e) => setReferralInput(e.target.value)}
                className="field-input text-xs uppercase font-mono tracking-wider"
              />
              <p className="text-[11px] text-zinc-400 mt-1 font-mono">
                Attaches your registration to your referring PR member for fast verification.
              </p>
            </div>

            <button
              type="submit"
              disabled={!selectedClubSlug || loading}
              className="btn-primary mt-2 w-full py-2.5 text-xs font-medium"
            >
              Continue to Registration Form →
            </button>
          </form>

          <div className="flex flex-col gap-2 border-t border-zinc-100 pt-4 text-xs text-zinc-500 min-[420px]:flex-row min-[420px]:items-center min-[420px]:justify-between">
            <span>Already submitted a registration?</span>
            <Link href="/my-status" className="inline-flex min-h-8 items-center font-medium text-brand-600 hover:underline focus:outline-none focus:ring-2 focus:ring-brand-500/20">
              Look up your live ticket status →
            </Link>
          </div>
        </section>
      </main>
    </>
  );
}
