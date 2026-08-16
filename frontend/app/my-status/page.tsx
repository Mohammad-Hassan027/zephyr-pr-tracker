"use client";

import { useState } from "react";
import Link from "next/link";
import Header from "@/components/Header";
import { lookupRegistrations, LookupResult } from "@/lib/api";

export default function MyStatusPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [registrations, setRegistrations] = useState<LookupResult[]>([]);
  const [error, setError] = useState("");
  const [copiedId, setCopiedId] = useState<string | null>(null);

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;

    setLoading(true);
    setError("");
    setSearched(true);

    try {
      const data = await lookupRegistrations({
        studentEmail: email.trim().toLowerCase(),
      });
      setRegistrations(data.registrations || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to find registrations");
      setRegistrations([]);
    } finally {
      setLoading(false);
    }
  }

  function handleCopyLink(id: string) {
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    const url = `${origin}/status/${id}`;
    navigator.clipboard.writeText(url);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2500);
  }

  return (
    <>
      <Header />
      <main className="page-shell space-y-6">
        <section className="surface-card border-accent/20 bg-gradient-to-br from-accent/10 via-white to-accentAlt/10 p-5 sm:p-6 text-center max-w-2xl mx-auto">
          <p className="pill-chip">Self-Service Portal</p>
          <h1 className="page-title mt-3">Find Your Registration</h1>
          <p className="page-subtitle">
            Enter the email address you used when registering to view your live ticket status, registration number, or payment verification updates.
          </p>

          <form onSubmit={handleSearch} className="mt-6 flex flex-col sm:flex-row gap-3 justify-center">
            <input
              type="email"
              required
              placeholder="student@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="field-input sm:max-w-xs text-center sm:text-left"
            />
            <button
              type="submit"
              disabled={loading}
              className="btn-primary whitespace-nowrap"
            >
              {loading ? "Searching..." : "Lookup Status"}
            </button>
          </form>
        </section>

        {error && (
          <div className="max-w-2xl mx-auto rounded-2xl border border-red-200 bg-red-50 p-4 text-center text-sm text-red-700">
            {error}
          </div>
        )}

        {searched && !loading && (
          <section className="max-w-2xl mx-auto space-y-4">
            <div className="flex items-center justify-between px-1">
              <h2 className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">
                Registrations for {email}
              </h2>
              <span className="text-xs text-slate-500 font-medium">
                {registrations.length} {registrations.length === 1 ? "found" : "found"}
              </span>
            </div>

            {registrations.length === 0 ? (
              <div className="surface-card p-8 text-center">
                <p className="text-base font-semibold text-ink">
                  No registrations found for this email
                </p>
                <p className="mt-1 text-sm text-slate-600">
                  Double-check your email spelling or browse clubs to register.
                </p>
                <Link href="/clubs" className="btn-primary mt-4 inline-block">
                  Explore Clubs &amp; Events
                </Link>
              </div>
            ) : (
              <div className="space-y-4">
                {registrations.map((reg) => (
                  <article
                    key={reg.id}
                    className="surface-card p-5 transition hover:shadow-md border border-slate-200/80"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                          {reg.club?.name || "Event"}
                        </span>
                        <h3 className="text-lg font-semibold text-ink mt-0.5">
                          {reg.event?.name || "Event Registration"}
                        </h3>
                        {reg.event?.date && (
                          <p className="text-xs text-slate-500 mt-0.5">
                            {new Date(reg.event.date).toLocaleDateString(undefined, {
                              weekday: "short",
                              month: "short",
                              day: "numeric",
                              year: "numeric",
                            })}
                            {reg.event.venue ? ` · ${reg.event.venue}` : ""}
                          </p>
                        )}
                      </div>

                      <div>
                        {reg.status === "approved" && (
                          <span className="rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-700 border border-emerald-500/20">
                            ✓ Approved · {reg.regNo}
                          </span>
                        )}
                        {reg.status === "pending" && (
                          <span className="rounded-full bg-amber-500/10 px-3 py-1 text-xs font-semibold text-amber-700 border border-amber-500/20">
                            ⏳ Under Verification
                          </span>
                        )}
                        {reg.status === "rejected" && (
                          <span className="rounded-full bg-red-500/10 px-3 py-1 text-xs font-semibold text-red-700 border border-red-500/20">
                            ✕ Rejected
                          </span>
                        )}
                      </div>
                    </div>

                    {reg.status === "rejected" && reg.rejectionReason && (
                      <div className="mt-3 rounded-xl bg-red-50/80 p-3 text-xs text-red-700 border border-red-200/60">
                        <span className="font-semibold">Reason:</span> {reg.rejectionReason}
                      </div>
                    )}

                    <div className="mt-4 pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-500">
                      <div>
                        Submitted on {new Date(reg.createdAt).toLocaleDateString()}
                        {reg.amount ? ` · Paid ₹${reg.amount}` : ""}
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => handleCopyLink(reg.id)}
                          className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 font-semibold text-slate-700 hover:bg-slate-100 transition"
                        >
                          {copiedId === reg.id ? "✓ Copied!" : "Copy link"}
                        </button>
                        <Link
                          href={`/status/${reg.id}`}
                          className="rounded-full bg-accent px-3.5 py-1.5 font-semibold text-white hover:bg-accent/90 transition shadow-sm"
                        >
                          View Status Card →
                        </Link>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>
        )}
      </main>
    </>
  );
}
