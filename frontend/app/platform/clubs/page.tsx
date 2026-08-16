"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import Header from "@/components/Header";
import { useDebouncedValue } from "@/lib/useDebouncedValue";

type PlatformClub = {
  _id: string;
  name: string;
  slug: string;
  email: string;
  status: "pending" | "approved" | "rejected";
  createdAt: string;
};

type Pagination = {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
};

export default function PlatformClubsPage() {
  const [password, setPassword] = useState("");
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loginError, setLoginError] = useState("");
  const [loadingLogin, setLoadingLogin] = useState(false);

  const [clubs, setClubs] = useState<PlatformClub[]>([]);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [loadingClubs, setLoadingClubs] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [msg, setMsg] = useState("");

  // Filters and pagination
  const [statusFilter, setStatusFilter] = useState<"pending" | "approved" | "rejected" | "all">("pending");
  const [searchQuery, setSearchQuery] = useState("");
  const debouncedSearch = useDebouncedValue(searchQuery, 300);
  const [page, setPage] = useState(1);

  // Custom Reject Modal State
  const [rejectModal, setRejectModal] = useState<{
    isOpen: boolean;
    club: PlatformClub | null;
  }>({ isOpen: false, club: null });

  const activeRef = useRef(true);
  const loadAbortRef = useRef<AbortController | null>(null);

  const loadClubs = useCallback(
    async (targetPage: number, signal?: AbortSignal) => {
      setLoadingClubs(true);
      setMsg("");
      try {
        const params = new URLSearchParams();
        params.set("page", String(targetPage));
        params.set("limit", "15");
        if (statusFilter !== "all") params.set("status", statusFilter);
        if (debouncedSearch.trim()) params.set("q", debouncedSearch.trim());

        const res = await fetch(`/api/platform/clubs/all?${params.toString()}`, { signal });
        if (!activeRef.current || signal?.aborted) return;
        if (res.status === 401 || res.status === 403) {
          setIsAuthenticated(false);
          return;
        }
        const data = await res.json();
        if (!activeRef.current || signal?.aborted) return;
        if (res.ok) {
          setIsAuthenticated(true);
          setClubs(data.items ?? data);
          if (data.pagination) {
            setPagination(data.pagination);
            setPage(data.pagination.page);
          }
        } else {
          setMsg(data.error || "Failed to load clubs");
        }
      } catch (err) {
        if (!activeRef.current || (err instanceof DOMException && err.name === "AbortError")) return;
        setMsg("Failed to connect to platform admin endpoint");
      } finally {
        if (activeRef.current && !signal?.aborted) {
          setLoadingClubs(false);
        }
      }
    },
    [statusFilter, debouncedSearch],
  );

  useEffect(() => {
    activeRef.current = true;
    loadAbortRef.current?.abort();
    const controller = new AbortController();
    loadAbortRef.current = controller;
    setPage(1);
    loadClubs(1, controller.signal);
    return () => {
      activeRef.current = false;
      controller.abort();
    };
  }, [loadClubs]);

  function reload(targetPage = page) {
    loadAbortRef.current?.abort();
    const controller = new AbortController();
    loadAbortRef.current = controller;
    loadClubs(targetPage, controller.signal);
  }

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
        reload(1);
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
        reload();
      } else {
        const body = await res.json();
        setMsg(body.error || "Approval failed");
      }
    } finally {
      setBusyId(null);
    }
  }

  async function confirmRejection() {
    if (!rejectModal.club) return;
    setBusyId(rejectModal.club._id);
    try {
      const res = await fetch(`/api/platform/clubs/${rejectModal.club._id}/reject`, {
        method: "PATCH",
      });
      if (res.ok) {
        setRejectModal({ isOpen: false, club: null });
        reload();
      } else {
        const body = await res.json();
        setMsg(body.error || "Rejection failed");
      }
    } finally {
      setBusyId(null);
    }
  }

  function handlePageChange(newPage: number) {
    if (!pagination) return;
    if (newPage < 1 || newPage > pagination.totalPages) return;
    reload(newPage);
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
          <h1 className="page-title mt-3">Club Application Management</h1>
          <p className="page-subtitle">
            Review new club registrations, grant access to host events, and monitor platform activity.
          </p>
        </section>

        {msg && (
          <p className="rounded-2xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {msg}
          </p>
        )}

        {/* Filter Controls & Search */}
        <section className="surface-card p-5 sm:p-6 space-y-4">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            {/* Status Tabs */}
            <div className="flex flex-wrap gap-1.5">
              {[
                { label: "Pending", value: "pending" as const },
                { label: "Approved", value: "approved" as const },
                { label: "Rejected", value: "rejected" as const },
                { label: "All Clubs", value: "all" as const },
              ].map((tab) => (
                <button
                  key={tab.value}
                  type="button"
                  onClick={() => setStatusFilter(tab.value)}
                  className={`rounded-full px-3.5 py-1.5 text-xs font-semibold transition ${
                    statusFilter === tab.value
                      ? "bg-accent text-white shadow-sm"
                      : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Search Input */}
            <div className="w-full sm:w-72">
              <input
                type="text"
                placeholder="Search name, slug, email..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="field-input text-xs py-1.5"
              />
            </div>
          </div>

          <div className="flex items-center justify-between border-t border-slate-100 pt-3">
            <h2 className="text-sm font-semibold text-ink">
              {pagination ? `${pagination.total} clubs found` : "Club List"}
            </h2>
            <button
              onClick={() => reload()}
              className="text-xs font-semibold text-accent hover:underline"
            >
              Refresh
            </button>
          </div>

          {loadingClubs ? (
            <div className="p-8 text-center text-sm text-slate-500">
              <div className="mx-auto mb-3 h-8 w-8 animate-spin rounded-full border-2 border-accent border-t-transparent" />
              Loading clubs...
            </div>
          ) : clubs.length === 0 ? (
            <div className="p-8 text-center text-slate-500 rounded-2xl border border-dashed border-slate-200">
              <p className="text-base font-semibold text-ink">
                No clubs found.
              </p>
              <p className="mt-1 text-xs">
                No applications match the current filter or search criteria.
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
                        {c.status === "approved" ? (
                          <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-700 ring-1 ring-inset ring-emerald-600/20">
                            Approved
                          </span>
                        ) : c.status === "rejected" ? (
                          <span className="rounded-full bg-rose-50 px-2.5 py-0.5 text-[11px] font-semibold text-rose-700 ring-1 ring-inset ring-rose-600/20">
                            Rejected
                          </span>
                        ) : (
                          <span className="rounded-full bg-amber-50 px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-[0.1em] text-amber-700 ring-1 ring-inset ring-amber-600/20">
                            Pending Approval
                          </span>
                        )}
                      </div>
                      <p className="mt-1 font-mono text-xs text-slate-500">
                        URL Slug: <span className="font-semibold text-ink">/register/{c.slug}</span>
                      </p>
                      <p className="mt-1 text-xs text-slate-500">
                        Admin Email: <span className="text-slate-700 font-medium">{c.email}</span>
                      </p>
                      <p className="mt-1 text-xs text-slate-400">
                        Registered: {new Date(c.createdAt).toLocaleDateString()}
                      </p>
                    </div>

                    <div className="flex flex-wrap gap-2 sm:shrink-0 sm:items-center">
                      {c.status !== "approved" && (
                        <button
                          disabled={busyId === c._id}
                          onClick={() => handleApprove(c._id)}
                          className="rounded-full bg-emerald-600 px-3.5 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-emerald-700 disabled:opacity-50 transition"
                        >
                          {busyId === c._id ? "Processing..." : "✓ Approve Club"}
                        </button>
                      )}
                      {c.status !== "rejected" && (
                        <button
                          disabled={busyId === c._id}
                          onClick={() => setRejectModal({ isOpen: true, club: c })}
                          className="rounded-full border border-red-200 bg-white px-3.5 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-50 disabled:opacity-50 transition"
                        >
                          ✕ Reject
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Pagination */}
          {!loadingClubs && pagination && pagination.totalPages > 1 && (
            <div className="flex items-center justify-between border-t border-slate-100 pt-4">
              <p className="text-xs text-slate-500">
                Page <span className="font-semibold text-ink">{pagination.page}</span> of{" "}
                <span className="font-semibold text-ink">{pagination.totalPages}</span>
              </p>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handlePageChange(page - 1)}
                  disabled={!pagination.hasPrevPage}
                  className="rounded-full border border-slate-200 bg-white px-4 py-1.5 text-xs font-semibold text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  ← Previous
                </button>
                <button
                  onClick={() => handlePageChange(page + 1)}
                  disabled={!pagination.hasNextPage}
                  className="rounded-full border border-slate-200 bg-white px-4 py-1.5 text-xs font-semibold text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Next →
                </button>
              </div>
            </div>
          )}
        </section>

        {/* Custom Rejection Confirmation Modal (Gap 2.7) */}
        {rejectModal.isOpen && rejectModal.club && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm">
            <div className="surface-card w-full max-w-sm p-6 shadow-2xl space-y-4">
              <h3 className="text-lg font-semibold text-ink">
                Reject Club Application
              </h3>
              <p className="text-xs text-slate-600">
                Are you sure you want to reject the application for{" "}
                <strong>{rejectModal.club.name}</strong> ({rejectModal.club.email})?
              </p>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setRejectModal({ isOpen: false, club: null })}
                  className="btn-secondary py-1.5 px-4 text-xs"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={confirmRejection}
                  disabled={busyId === rejectModal.club._id}
                  className="rounded-full bg-red-600 px-4 py-1.5 text-xs font-semibold text-white hover:bg-red-700 shadow-sm transition"
                >
                  Confirm Rejection
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </>
  );
}
