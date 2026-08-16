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
          <div className="surface-card w-full p-8 text-center">
            <div className="mx-auto mb-3 h-8 w-8 animate-spin rounded-full border-2 border-accent border-t-transparent" />
            <p className="text-sm text-slate-500">Loading registration portal…</p>
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

  // Handle direct redirection if club query parameter is already supplied
  useEffect(() => {
    if (clubSlug) {
      const params = new URLSearchParams();
      if (refCode) params.set("ref", refCode);
      if (eventSlug) params.set("event", eventSlug);
      const queryStr = params.toString();
      router.replace(`/register/${encodeURIComponent(clubSlug)}${queryStr ? `?${queryStr}` : ""}`);
    }
  }, [clubSlug, refCode, eventSlug, router]);

  // Load clubs for interactive selector
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
          <p className="pill-chip">Redirecting</p>
          <h1 className="mt-3 text-xl font-semibold text-ink">
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
      <main className="page-shell max-w-3xl space-y-6 py-6 sm:py-10">
        <section className="surface-card border-accent/20 bg-gradient-to-br from-accent/10 via-white to-accentAlt/10 p-5 sm:p-7 text-center">
          <p className="pill-chip">Registration Portal</p>
          <h1 className="page-title mt-3">Select a Club & Register</h1>
          <p className="page-subtitle max-w-xl mx-auto mt-2">
            Choose the club and event you want to participate in, apply any PR referral code, and verify your payment proof.
          </p>
        </section>

        <section className="surface-card p-6 sm:p-7 space-y-5">
          <form onSubmit={handleProceed} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1.5">
                1. Search & Select Club
              </label>
              <input
                type="text"
                placeholder="Search clubs or events (e.g. ACM, IEEE, Coding War)..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="field-input text-sm mb-2"
              />

              {loading ? (
                <div className="p-4 text-center text-xs text-slate-400">Loading clubs…</div>
              ) : filteredClubs.length === 0 ? (
                <div className="rounded-xl border border-slate-200 p-4 text-center text-xs text-slate-500">
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
                      className={`text-left p-3 rounded-xl border transition ${
                        selectedClubSlug === c.slug
                          ? "border-accent bg-accent/5 ring-1 ring-accent"
                          : "border-slate-200 hover:border-slate-300 bg-white"
                      }`}
                    >
                      <p className="font-semibold text-ink text-sm">{c.name}</p>
                      <p className="text-xs text-slate-500 mt-0.5">
                        {c.events.length} {c.events.length === 1 ? "event" : "events"} available
                      </p>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {currentClub && (
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1.5">
                  2. Select Event ({currentClub.name})
                </label>
                <select
                  value={selectedEventSlug}
                  onChange={(e) => setSelectedEventSlug(e.target.value)}
                  className="field-input text-sm"
                >
                  <option value="">Choose an event (optional)</option>
                  {currentClub.events.map((ev) => (
                    <option key={ev.slug} value={ev.slug}>
                      {ev.name} {ev.fee !== undefined ? `(₹${ev.fee})` : ""}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1.5">
                3. PR Referral Code (Optional)
              </label>
              <input
                type="text"
                placeholder="e.g. AMAN126"
                value={referralInput}
                onChange={(e) => setReferralInput(e.target.value)}
                className="field-input text-sm uppercase font-mono"
              />
              <p className="text-[11px] text-slate-400 mt-1">
                If a PR team member referred you, enter their code here so they can verify your submission.
              </p>
            </div>

            <button
              type="submit"
              disabled={!selectedClubSlug || loading}
              className="btn-primary w-full py-3 text-sm font-semibold shadow-md mt-2"
            >
              Continue to Registration Form →
            </button>
          </form>

          <div className="border-t border-slate-200/80 pt-4 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
            <span>Already registered?</span>
            <Link href="/my-status" className="font-semibold text-accent hover:underline">
              🔍 Look up your registration ticket status →
            </Link>
          </div>
        </section>
      </main>
    </>
  );
}
