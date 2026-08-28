"use client";

import { useState } from "react";
import Link from "next/link";
import Header from "@/components/Header";
import { lookupRegistrations, LookupResult } from "@/lib/api/registrations";
import { Calendar, MapPin, Copy, Check, Search, ArrowRight } from "@/lib/icons";
import StatusIcon from "@/components/icons/StatusIcon";

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
        <section className="surface-card p-6 sm:p-8 text-center max-w-2xl mx-auto">
          <span className="pill-chip">Lookup Pass</span>
          <h1 className="page-title mt-2">Find Your Registration</h1>
          <p className="page-subtitle mx-auto">
            Enter the email address you used when registering to access your live ticket pass, registration number, or verification updates.
          </p>

          <form onSubmit={handleSearch} className="mt-6 flex flex-col sm:flex-row gap-2 justify-center max-w-md mx-auto">
            <input
              type="email"
              required
              placeholder="student@college.edu"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="field-input text-xs"
            />
            <button
              type="submit"
              disabled={loading}
              className="btn-primary whitespace-nowrap text-xs py-2 px-4"
            >
              {loading ? "Searching..." : "Lookup Pass →"}
            </button>
          </form>
        </section>

        {error && (
          <div className="max-w-2xl mx-auto rounded-lg border border-rose-200 bg-rose-50 p-4 text-center text-xs font-medium text-rose-700">
            {error}
          </div>
        )}

        {searched && !loading && (
          <section className="max-w-2xl mx-auto space-y-3">
            <div className="flex items-center justify-between px-1">
              <span className="text-[10px] font-mono font-semibold uppercase tracking-wider text-zinc-400">
                Registrations for {email}
              </span>
              <span className="pill-chip font-mono">
                {registrations.length} {registrations.length === 1 ? "found" : "found"}
              </span>
            </div>

            {registrations.length === 0 ? (
              <div className="surface-card p-8 text-center">
                <p className="text-sm font-semibold text-zinc-900">
                  No registrations found for this email
                </p>
                <p className="mt-1 text-xs text-zinc-500">
                  Double-check your email address or explore active clubs to register.
                </p>
                <Link href="/clubs" className="btn-primary mt-4 text-xs inline-block">
                  Explore Clubs &amp; Events →
                </Link>
              </div>
            ) : (
              <div className="space-y-3">
                {registrations.map((reg) => (
                  <article
                    key={reg.id}
                    className="surface-card p-5 transition hover:border-zinc-300"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <span className="font-mono text-[10px] uppercase tracking-wider text-zinc-400">
                          {reg.club?.name || "Club Event"}
                        </span>
                        <h3 className="text-base font-bold text-zinc-900 mt-0.5">
                          {reg.event?.name || "Event Registration"}
                        </h3>
                        {reg.event?.date && (
                          <p className="text-[11px] text-zinc-500 mt-0.5 font-mono flex flex-wrap items-center gap-x-3 gap-y-1">
                            <span className="inline-flex items-center gap-1">
                              <Calendar size={11} aria-hidden="true" />
                              <span>
                                {new Date(reg.event.date).toLocaleDateString(undefined, {
                                  weekday: "short",
                                  month: "short",
                                  day: "numeric",
                                })}
                              </span>
                            </span>
                            {reg.event.venue && (
                              <span className="inline-flex items-center gap-1">
                                <MapPin size={11} aria-hidden="true" />
                                <span>{reg.event.venue}</span>
                              </span>
                            )}
                          </p>
                        )}
                      </div>

                      <div>
                        <StatusIcon status={reg.status} />
                      </div>
                    </div>

                    {reg.status === "rejected" && reg.rejectionReason && (
                      <div className="mt-3 rounded-lg bg-rose-50/70 p-2.5 text-xs text-rose-800 border border-rose-200/60 font-sans">
                        <strong className="uppercase text-[10px] tracking-wider">Reason:</strong> {reg.rejectionReason}
                      </div>
                    )}

                    <div className="mt-4 pt-3 border-t border-zinc-100 flex flex-wrap items-center justify-between gap-3 text-xs">
                      <div className="text-[11px] text-zinc-400 font-mono">
                        Submitted {new Date(reg.createdAt).toLocaleDateString()}
                        {reg.amount ? ` · Paid ₹${reg.amount}` : ""}
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => handleCopyLink(reg.id)}
                          className="btn-secondary py-1 px-2.5 text-xs inline-flex items-center gap-1"
                        >
                          {copiedId === reg.id ? (
                            <>
                              <Check size={13} className="text-emerald-600" aria-hidden="true" />
                              <span>Copied</span>
                            </>
                          ) : (
                            <>
                              <Copy size={13} aria-hidden="true" />
                              <span>Copy Link</span>
                            </>
                          )}
                        </button>
                        <Link
                          href={`/status/${reg.id}`}
                          className="btn-primary py-1 px-3 text-xs"
                        >
                          View Pass →
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
