"use client";

import { useState } from "react";
import Link from "next/link";
import Header from "@/components/Header";
import { lookupRegistrations, LookupResult } from "@/lib/api/registrations";
import { saveRegistrationToken } from "@/lib/registration-token";
import { Calendar, MapPin, Copy, Check } from "@/lib/icons";
import StatusIcon from "@/components/icons/StatusIcon";

export default function MyStatusPage() {
  const [email, setEmail] = useState("");
  const [accessToken, setAccessToken] = useState("");
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [registrations, setRegistrations] = useState<LookupResult[]>([]);
  const [error, setError] = useState("");
  const [copiedId, setCopiedId] = useState<string | null>(null);

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim() || !accessToken.trim()) return;

    setLoading(true);
    setError("");
    setSearched(true);

    try {
      const data = await lookupRegistrations({
        studentEmail: email.trim().toLowerCase(),
        accessToken: accessToken.trim(),
      });
      const results = data.registrations || [];
      setRegistrations(results);
      results.forEach((r) => {
        saveRegistrationToken(r.id, accessToken.trim());
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to find registrations");
      setRegistrations([]);
    } finally {
      setLoading(false);
    }
  }

  function handleCopyLink(id: string) {
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    const tokenPart = accessToken.trim() ? `#token=${accessToken.trim()}` : "";
    const url = `${origin}/status/${id}${tokenPart}`;
    navigator.clipboard.writeText(url);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2500);
  }

  return (
    <>
      <Header />
      <main className="page-shell space-y-6">
        <section className="surface-card mx-auto max-w-2xl p-5 text-center sm:p-8">
          <span className="pill-chip">Lookup Pass</span>
          <h1 className="page-title mt-2">Find Your Registration</h1>
          <p className="page-subtitle mx-auto">
            Enter your registration email and the access token issued during your registration to access your live ticket pass.
          </p>

          <form onSubmit={handleSearch} className="mx-auto mt-6 flex max-w-md flex-col justify-center gap-2.5">
            <input
              type="email"
              required
              placeholder="student@college.edu"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="field-input text-xs"
            />
            <input
              type="text"
              required
              placeholder="Access Token (issued on submission)"
              value={accessToken}
              onChange={(e) => setAccessToken(e.target.value)}
              className="field-input text-xs font-mono"
            />
            <button
              type="submit"
              disabled={loading}
              className="btn-primary w-full py-2.5 text-xs sm:whitespace-nowrap"
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
            <div className="flex flex-col gap-2 px-1 min-[420px]:flex-row min-[420px]:items-center min-[420px]:justify-between">
              <span className="break-all text-[10px] font-mono font-semibold uppercase tracking-wider text-zinc-400">
                Registrations for {email}
              </span>
              <span className="pill-chip font-mono">
                {registrations.length} {registrations.length === 1 ? "found" : "found"}
              </span>
            </div>

            {registrations.length === 0 ? (
              <div className="surface-card p-8 text-center">
                <p className="text-sm font-semibold text-zinc-900">
                  No registrations found for this email and token
                </p>
                <p className="mt-1 text-xs text-zinc-500">
                  Double-check your email address and access token or explore active clubs to register.
                </p>
                <Link href="/clubs" className="btn-primary mt-4 text-xs">
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
                    <div className="flex flex-col gap-3 min-[420px]:flex-row min-[420px]:items-start min-[420px]:justify-between">
                      <div className="min-w-0">
                        <span className="font-mono text-[10px] uppercase tracking-wider text-zinc-400">
                          {reg.club?.name || "Club Event"}
                        </span>
                        <h3 className="mt-0.5 break-words text-base font-bold text-zinc-900">
                          {reg.event?.name || "Event Registration"}
                        </h3>
                        {reg.event?.date && (
                          <p className="text-[11px] text-zinc-500 mt-0.5 font-mono flex flex-wrap items-center gap-x-3 gap-y-1">
                            <span className="inline-flex items-center gap-1">
                              <Calendar size={11} className="shrink-0" aria-hidden="true" />
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
                                <MapPin size={11} className="shrink-0" aria-hidden="true" />
                                <span className="break-words">{reg.event.venue}</span>
                              </span>
                            )}
                          </p>
                        )}
                      </div>

                      <div className="self-start">
                        <StatusIcon status={reg.status} />
                      </div>
                    </div>

                    {reg.status === "rejected" && reg.rejectionReason && (
                      <div className="mt-3 rounded-lg bg-rose-50/70 p-2.5 text-xs text-rose-800 border border-rose-200/60 font-sans">
                        <strong className="uppercase text-[10px] tracking-wider">Reason:</strong> {reg.rejectionReason}
                      </div>
                    )}

                    <div className="mt-4 flex flex-col gap-3 border-t border-zinc-100 pt-3 text-xs min-[420px]:flex-row min-[420px]:items-center min-[420px]:justify-between">
                      <div className="break-words text-[11px] text-zinc-400 font-mono">
                        Submitted {new Date(reg.createdAt).toLocaleDateString()}
                        {reg.amount ? ` · Paid ₹${reg.amount}` : ""}
                      </div>

                      <div className="grid grid-cols-1 gap-2 min-[420px]:flex min-[420px]:items-center">
                        <button
                          type="button"
                          onClick={() => handleCopyLink(reg.id)}
                          className="btn-secondary px-2.5 py-2 text-xs"
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
                          href={`/status/${reg.id}${accessToken.trim() ? `#token=${accessToken.trim()}` : ""}`}
                          className="btn-primary px-3 py-2 text-xs"
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
