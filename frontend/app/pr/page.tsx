"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";

type ClubOption = {
  name: string;
  slug: string;
};

function PRLoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const queryClub = searchParams.get("club") || searchParams.get("clubSlug") || "";

  const [clubSlug, setClubSlug] = useState(queryClub);
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [clubs, setClubs] = useState<ClubOption[]>([]);

  const isExpired = searchParams.get("expired") === "1" || searchParams.get("expired") === "true";
  const isLoggedOut = searchParams.get("logout") === "1";

  useEffect(() => {
    if (queryClub) {
      setClubSlug(queryClub);
    }
  }, [queryClub]);

  useEffect(() => {
    async function loadClubs() {
      try {
        const res = await fetch("/api/clubs-directory");
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data)) {
            const parsed = data.map((c: any) => ({ name: c.name, slug: c.slug }));
            setClubs(parsed);
            if (!queryClub && parsed.length > 0) {
              setClubSlug((prev) => prev || parsed[0].slug);
            }
          }
        }
      } catch {
        // Ignore fetch error, fallback to text input
      }
    }
    loadClubs();
  }, [queryClub]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/pr-login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code, password, clubSlug }),
      });
      if (res.ok) {
        router.push("/pr/dashboard");
        router.refresh();
      } else {
        const body = await res.json();
        setError(body.error || "Invalid code or PIN");
      }
    } catch {
      setError("Network error. Could not connect to server.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center p-4 sm:p-6">
      <div className="surface-card w-full max-w-sm p-6 sm:p-8 space-y-5">
        <div className="text-center">
          <span className="pill-chip">PR Command Portal</span>
          <h1 className="text-xl font-bold text-zinc-900 mt-2">
            PR Member Sign In
          </h1>
          <p className="text-xs text-zinc-500 mt-1">
            Access your assigned review queue with your club, referral code, and 6-digit PIN.
          </p>
        </div>

        {isExpired && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-2.5 text-center text-xs font-medium text-amber-800">
            Your session expired. Please sign in again.
          </div>
        )}

        {isLoggedOut && !isExpired && (
          <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-2.5 text-center text-xs font-medium text-emerald-800">
            Signed out securely.
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-3.5">
          <div>
            <label className="block text-[10px] font-mono uppercase text-zinc-400 mb-1">
              Club / Organization
            </label>
            {clubs.length > 0 ? (
              <select
                required
                className="field-input text-xs"
                value={clubSlug}
                onChange={(e) => setClubSlug(e.target.value)}
              >
                <option value="" disabled>Select your club...</option>
                {clubs.map((c) => (
                  <option key={c.slug} value={c.slug}>
                    {c.name} ({c.slug})
                  </option>
                ))}
              </select>
            ) : (
              <input
                required
                placeholder="e.g. acm-student-chapter"
                className="field-input text-xs lowercase tracking-wider"
                value={clubSlug}
                onChange={(e) => setClubSlug(e.target.value)}
              />
            )}
          </div>

          <div>
            <label className="block text-[10px] font-mono uppercase text-zinc-400 mb-1">
              Member Referral Code
            </label>
            <input
              required
              placeholder="e.g. AMAN12"
              className="field-input text-xs uppercase font-mono tracking-wider"
              value={code}
              onChange={(e) => setCode(e.target.value)}
            />
          </div>

          <div>
            <label className="block text-[10px] font-mono uppercase text-zinc-400 mb-1">
              Security PIN
            </label>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                required
                placeholder="6-digit PIN"
                className="field-input text-xs font-mono pr-10"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 text-xs"
                aria-label={showPassword ? "Hide PIN" : "Show PIN"}
              >
                {showPassword ? "Hide" : "Show"}
              </button>
            </div>
          </div>

          {error && (
            <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-medium text-rose-700">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="btn-primary w-full py-2.5 text-xs font-semibold mt-2"
          >
            {loading ? "Verifying credentials..." : "Sign In to Workspace →"}
          </button>
        </form>

        <div className="border-t border-zinc-100 pt-3 text-center text-xs text-zinc-400">
          <Link href="/clubs" className="hover:text-zinc-700 transition">
            ← Return to public directory
          </Link>
        </div>
      </div>
    </main>
  );
}

export default function PRLoginPage() {
  return (
    <Suspense fallback={<div className="flex min-h-screen items-center justify-center text-xs text-zinc-400 font-mono">Loading portal...</div>}>
      <PRLoginForm />
    </Suspense>
  );
}
