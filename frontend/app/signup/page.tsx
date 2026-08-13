"use client";

import { useState } from "react";
import Link from "next/link";

export default function SignupPage() {
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  function handleNameChange(val: string) {
    setName(val);
    if (!slug) {
      setSlug(
        val
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/^-+|-+$/g, "")
      );
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, slug, email, password }),
      });
      const data = await res.json();

      if (res.ok) {
        setSubmitted(true);
      } else {
        setError(data.error || "Signup failed");
      }
    } catch (_err) {
      setError("An unexpected error occurred. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  if (submitted) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-canvas p-4 sm:p-6">
        <div className="surface-card w-full max-w-md p-6 text-center sm:p-8">
          <p className="pill-chip">Registration Submitted</p>
          <h1 className="mt-3 text-2xl font-semibold text-ink">
            Your club is pending approval
          </h1>
          <p className="mt-2 text-sm text-slate-500">
            Thank you for registering <strong className="text-ink">{name}</strong>!
            Your application has been received and is awaiting approval by the platform administrator.
          </p>

          <div className="mt-6 rounded-2xl border border-accent/20 bg-accent/10 p-4 text-xs text-slate-700">
            Once approved, you will be able to log in with your email <code className="font-semibold">{email}</code> and access your club admin dashboard.
          </div>

          <Link href="/login" className="btn-primary mt-6 inline-block w-full">
            Go to club login
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-canvas p-4 sm:p-6">
      <div className="surface-card w-full max-w-md p-6 sm:p-8">
        <p className="text-center text-sm font-semibold uppercase tracking-[0.25em] text-accent">
          Zephyr
        </p>
        <h1 className="mt-2 text-center text-2xl font-semibold text-ink">
          Register your club
        </h1>
        <p className="mt-1 text-center text-sm text-slate-500">
          Create a club account to manage events and your PR team.
        </p>

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-[0.15em] text-slate-500">
              Club Name
            </label>
            <input
              type="text"
              required
              placeholder="e.g. Coding Club"
              className="field-input"
              value={name}
              onChange={(e) => handleNameChange(e.target.value)}
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-[0.15em] text-slate-500">
              URL Slug (Unique)
            </label>
            <input
              type="text"
              required
              placeholder="e.g. coding-club"
              className="field-input lowercase"
              value={slug}
              onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))}
            />
            <p className="mt-1 text-[11px] text-slate-400">
              Registration link: /register/{slug || "your-slug"}
            </p>
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-[0.15em] text-slate-500">
              Club Email
            </label>
            <input
              type="email"
              required
              placeholder="admin@club.org"
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
              placeholder="••••••••"
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
            {loading ? "Submitting application..." : "Submit club registration"}
          </button>
        </form>

        <p className="mt-6 text-center text-xs text-slate-500">
          Already registered?{" "}
          <Link href="/login" className="font-semibold text-accent hover:underline">
            Log in to club admin
          </Link>
        </p>
      </div>
    </main>
  );
}
