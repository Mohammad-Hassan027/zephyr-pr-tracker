"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";

function LoginForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();

  const isExpired = searchParams.get("expired") === "1" || searchParams.get("expired") === "true";
  const isLoggedOut = searchParams.get("logout") === "1";

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();

      if (res.ok) {
        router.push("/admin");
        router.refresh();
      } else {
        setError(data.error || "Invalid email or password");
      }
    } catch (_err) {
      setError("An unexpected error occurred. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-canvas p-4 sm:p-6">
      <div className="surface-card w-full max-w-sm p-6 sm:p-7">
        <p className="text-center text-sm font-semibold uppercase tracking-[0.25em] text-accent">
          Zephyr
        </p>
        <h1 className="mt-2 text-center text-2xl font-semibold text-ink">
          Club admin login
        </h1>
        <p className="mt-1 text-center text-sm text-slate-500">
          Sign in with your club email and password.
        </p>

        {isExpired && (
          <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-3 py-2 text-center text-xs font-semibold text-amber-800">
            Your session has expired. Please sign in again.
          </div>
        )}

        {isLoggedOut && !isExpired && (
          <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-center text-xs font-semibold text-emerald-800">
            You have been signed out safely.
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-[0.15em] text-slate-500">
              Email
            </label>
            <input
              type="email"
              required
              placeholder="club@example.com"
              className="field-input"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-[0.15em] text-slate-500">
              Password
            </label>
            <input
              type="password"
              required
              placeholder="Password"
              className="field-input"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>

          {error && (
            <p className="rounded-2xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="btn-primary w-full"
          >
            {loading ? "Logging in..." : "Log in"}
          </button>
        </form>

        <p className="mt-6 text-center text-xs text-slate-500">
          Don't have a club account?{" "}
          <Link href="/signup" className="font-semibold text-accent hover:underline">
            Register your club
          </Link>
        </p>
      </div>
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="flex min-h-screen items-center justify-center text-sm text-slate-500">Loading...</div>}>
      <LoginForm />
    </Suspense>
  );
}
