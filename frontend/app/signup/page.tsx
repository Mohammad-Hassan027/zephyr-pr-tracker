"use client";

import { useState } from "react";
import Link from "next/link";

export default function SignupPage() {
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
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
      <main className="flex min-h-screen items-center justify-center p-3 py-5 sm:p-6">
        <div className="surface-card w-full max-w-md p-6 text-center sm:p-8 space-y-4">
          <span className="pill-chip">Application Received</span>
          <h1 className="text-xl font-bold text-zinc-900 mt-2">
            Club Application Pending Approval
          </h1>
          <p className="text-xs text-zinc-500">
            Thank you for registering <strong className="text-zinc-900">{name}</strong>!
            Your application has been received and is queued for verification by the platform administrator.
          </p>

          <div className="rounded-lg border border-brand-200 bg-brand-50/70 p-3.5 text-xs text-zinc-800">
            Once approved, you will be able to log in with your email <code className="break-all font-mono font-semibold">{email}</code> and publish your fest events.
          </div>

          <Link href="/login" className="btn-primary w-full py-2.5 text-xs font-semibold block text-center mt-4">
            Go to Club Sign In →
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen items-center justify-center p-3 py-5 sm:p-6">
      <div className="surface-card w-full max-w-md p-6 sm:p-8 space-y-5">
        <div className="text-center">
          <span className="pill-chip">Host Registration</span>
          <h1 className="text-xl font-bold text-zinc-900 mt-2">
            Register Your Club
          </h1>
          <p className="text-xs text-zinc-500 mt-1">
            Create an organizer workspace to host competitions, manage queues, and coordinate PR.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3.5">
          <div>
            <label className="block text-[10px] font-mono uppercase text-zinc-400 mb-1">
              Club / Society Name
            </label>
            <input
              type="text"
              required
              placeholder="e.g. Coding Club"
              className="field-input text-xs"
              value={name}
              onChange={(e) => handleNameChange(e.target.value)}
            />
          </div>

          <div>
            <label className="block text-[10px] font-mono uppercase text-zinc-400 mb-1">
              URL Slug (Unique Portal Path)
            </label>
            <input
              type="text"
              required
              placeholder="e.g. coding-club"
              className="field-input text-xs lowercase font-mono"
              value={slug}
              onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))}
            />
            <p className="mt-1 font-mono text-[10px] text-zinc-400">
              Registration URL: /register/{slug || "your-slug"}
            </p>
          </div>

          <div>
            <label className="block text-[10px] font-mono uppercase text-zinc-400 mb-1">
              Official Admin Email
            </label>
            <input
              type="email"
              required
              placeholder="admin@club.org"
              className="field-input text-xs font-mono"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>

          <div>
            <label className="block text-[10px] font-mono uppercase text-zinc-400 mb-1">
              Master Password
            </label>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                required
                placeholder="••••••••"
                className="field-input text-xs pr-10"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-1.5 top-1/2 inline-flex min-h-9 -translate-y-1/2 items-center rounded px-2 text-xs text-zinc-400 hover:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
                aria-label={showPassword ? "Hide password" : "Show password"}
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
            {loading ? "Submitting application..." : "Submit Club Registration →"}
          </button>
        </form>

        <p className="text-center text-xs text-zinc-500 border-t border-zinc-100 pt-3">
          Already registered?{" "}
          <Link href="/login" className="font-medium text-brand-600 hover:underline">
            Sign in to club admin →
          </Link>
        </p>
      </div>
    </main>
  );
}
