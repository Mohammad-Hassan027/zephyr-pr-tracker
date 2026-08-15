"use client";

import { useEffect, useRef, useState } from "react";
import Header from "@/components/Header";

type PendingClub = {
  _id: string;
  name: string;
  slug: string;
  email: string;
  createdAt: string;
};

export default function PlatformClubsPage() {
  const [password, setPassword] = useState("");
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loginError, setLoginError] = useState("");
  const [loadingLogin, setLoadingLogin] = useState(false);

  const [clubs, setClubs] = useState<PendingClub[]>([]);
  const [loadingClubs, setLoadingClubs] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [msg, setMsg] = useState("");
  const activeRef = useRef(true);
  const loadAbortRef = useRef<AbortController | null>(null);

  async function loadPendingClubs(signal?: AbortSignal) {
    setLoadingClubs(true);
    setMsg("");
    try {
      const res = await fetch("/api/platform/clubs/pending", { signal });
      if (!activeRef.current || signal?.aborted) return;
      if (res.status === 401 || res.status === 403) {
        setIsAuthenticated(false);
        return;
      }
      const data = await res.json();
      if (!activeRef.current || signal?.aborted) return;
      if (res.ok && Array.isArray(data)) {
        setIsAuthenticated(true);
        setClubs(data);
      } else {
        setMsg(data.error || "Failed to load pending clubs");
      }
    } catch (err) {
      if (!activeRef.current || (err instanceof DOMException && err.name === "AbortError")) return;
      setMsg("Failed to connect to platform admin endpoint");
    } finally {
      if (activeRef.current && !signal?.aborted) {
        setLoadingClubs(false);
      }
    }
  }

  useEffect(() => {
    activeRef.current = true;
    loadAbortRef.current?.abort();
    const controller = new AbortController();
    loadAbortRef.current = controller;
    loadPendingClubs(controller.signal);
    return () => {
      activeRef.current = false;
      controller.abort();
    };
  }, []);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoginError("");
    setLoadingLogin(true);

    try {
      const res = await fetch("/api/platform/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const data = await res.json();

      if (res.ok) {
        setIsAuthenticated(true);
        loadAbortRef.current?.abort();
        const controller = new AbortController();
        loadAbortRef.current = controller;
        loadPendingClubs(controller.signal);
      } else {
        setLoginError(data.error || "Invalid password");
      }
    } catch (_err) {
      setLoginError("Login failed");
    } finally {
      setLoadingLogin(false);
    }
  }

  async function handleApprove(id: string) {
    setBusyId(id);
    try {
      const res = await fetch(`/api/platform/clubs/${id}/approve`, {
        method: "PATCH",
      });
      if (res.ok) {
        loadAbortRef.current?.abort();
        const controller = new AbortController();
        loadAbortRef.current = controller;
        loadPendingClubs(controller.signal);
      } else {
        const body = await res.json();
        alert(body.error || "Approval failed");
      }
    } finally {
      setBusyId(null);
    }
  }

  async function handleReject(id: string) {
    if (!confirm("Are you sure you want to reject this club registration?")) return;
    setBusyId(id);
    try {
      const res = await fetch(`/api/platform/clubs/${id}/reject`, {
        method: "PATCH",
      });
      if (res.ok) {
        loadAbortRef.current?.abort();
        const controller = new AbortController();
        loadAbortRef.current = controller;
        loadPendingClubs(controller.signal);
      } else {
        const body = await res.json();
        alert(body.error || "Rejection failed");
      }
    } finally {
      setBusyId(null);
    }
  }

  if (!isAuthenticated) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-canvas p-4 sm:p-6">
        <div className="surface-card w-full max-w-sm p-6 sm:p-7">
          <p className="text-center text-sm font-semibold uppercase tracking-[0.25em] text-accent">
            Zephyr Platform
          </p>
          <h1 className="mt-2 text-center text-2xl font-semibold text-ink">
            Platform admin login
          </h1>
          <p className="mt-1 text-center text-sm text-slate-500">
            Enter platform password to review pending club signups.
          </p>

          <form onSubmit={handleLogin} className="mt-6 space-y-4">
            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-[0.15em] text-slate-500">
                Platform Admin Password
              </label>
              <input
                type="password"
                required
                placeholder="Platform password"
                className="field-input"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>

            {loginError && (
              <p className="rounded-2xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {loginError}
              </p>
            )}

            <button
              type="submit"
              disabled={loadingLogin}
              className="btn-primary w-full"
            >
              {loadingLogin ? "Authenticating..." : "Access platform admin"}
            </button>
          </form>
        </div>
      </main>
    );
  }

  return (
    <>
      <Header />
      <main className="page-shell space-y-6">
        <section className="surface-card border-accent/20 bg-gradient-to-br from-accent/10 via-white to-accentAlt/10 p-5 sm:p-6">
          <p className="pill-chip">Platform Control</p>
          <h1 className="page-title mt-3">Pending Club Applications</h1>
          <p className="page-subtitle">
            Review new club registrations and grant access to the platform.
          </p>
        </section>

        {msg && (
          <p className="rounded-2xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {msg}
          </p>
        )}

        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-ink">
              Pending Queue ({clubs.length})
            </h2>
            <button
              onClick={() => {
                loadAbortRef.current?.abort();
                const controller = new AbortController();
                loadAbortRef.current = controller;
                loadPendingClubs(controller.signal);
              }}
              className="text-xs font-semibold text-accent hover:underline"
            >
              Refresh queue
            </button>
          </div>

          {loadingClubs ? (
            <div className="surface-card p-8 text-center text-sm text-slate-500">
              Loading pending club applications...
            </div>
          ) : clubs.length === 0 ? (
            <div className="surface-card p-8 text-center">
              <p className="text-lg font-semibold text-ink">
                No pending club signups.
              </p>
              <p className="mt-2 text-sm text-slate-600">
                All club applications have been processed. New signups will appear here automatically.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {clubs.map((c) => (
                <div
                  key={c._id}
                  className="surface-card border-accent/15 bg-white/90 p-4 sm:p-5"
                >
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0 text-sm">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-semibold text-ink text-base">{c.name}</p>
                        <span className="rounded-full bg-amber-50 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-amber-700 ring-1 ring-inset ring-amber-600/20">
                          Pending Approval
                        </span>
                      </div>
                      <p className="mt-1 font-mono text-xs text-slate-500">
                        URL Slug: <span className="font-semibold text-ink">/register/{c.slug}</span>
                      </p>
                      <p className="mt-1 text-xs text-slate-500">
                        Admin Email: <span className="text-slate-700 font-medium">{c.email}</span>
                      </p>
                      <p className="mt-1 text-xs text-slate-400">
                        Submitted: {new Date(c.createdAt).toLocaleString()}
                      </p>
                    </div>

                    <div className="flex flex-col gap-2 sm:flex-row sm:shrink-0 sm:items-center">
                      <button
                        disabled={busyId === c._id}
                        onClick={() => handleApprove(c._id)}
                        className="btn-primary px-4 py-2 text-xs"
                      >
                        Approve Club
                      </button>
                      <button
                        disabled={busyId === c._id}
                        onClick={() => handleReject(c._id)}
                        className="btn-secondary px-4 py-2 text-xs"
                      >
                        Reject
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </main>
    </>
  );
}
