"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

function PRLoginForm() {
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const router = useRouter();
  const searchParams = useSearchParams();

  const isExpired = searchParams.get("expired") === "1" || searchParams.get("expired") === "true";
  const isLoggedOut = searchParams.get("logout") === "1";

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    const res = await fetch("/api/pr-login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code, password }),
    });
    if (res.ok) {
      router.push("/pr/dashboard");
      router.refresh();
    } else {
      const body = await res.json();
      setError(body.error || "Login failed");
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-canvas p-4 sm:p-6">
      <div className="surface-card w-full max-w-sm p-6 sm:p-7">
        <p className="text-center text-sm font-semibold uppercase tracking-[0.25em] text-accent">
          Zephyr
        </p>
        <h1 className="mt-2 text-center text-2xl font-semibold text-ink">
          PR member login
        </h1>
        <p className="mt-2 text-center text-sm text-slate-600">
          Use the referral code and PIN the admin gave you.
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
          <input
            required
            placeholder="Referral code"
            className="field-input uppercase"
            value={code}
            onChange={(e) => setCode(e.target.value)}
          />
          <input
            type="password"
            required
            placeholder="PIN"
            className="field-input"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          {error && (
            <p className="rounded-2xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </p>
          )}
          <button type="submit" className="btn-primary w-full">
            Log in
          </button>
        </form>
      </div>
    </main>
  );
}

export default function PRLoginPage() {
  return (
    <Suspense fallback={<div className="flex min-h-screen items-center justify-center text-sm text-slate-500">Loading...</div>}>
      <PRLoginForm />
    </Suspense>
  );
}
