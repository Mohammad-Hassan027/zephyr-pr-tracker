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
  const [showPassword, setShowPassword] = useState(false);
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
      <main className="flex min-h-screen items-center justify-center p-3 py-5 sm:p-6">
        <div className="surface-card w-full max-w-sm p-6 sm:p-8 space-y-5">
          <div className="text-center">
            <span className="pill-chip">Super Admin</span>
            <h1 className="text-xl font-bold text-zinc-900 mt-2">
              Platform Governance
            </h1>
            <p className="text-xs text-zinc-500 mt-1">
              Enter platform master key to review pending club activation requests.
            </p>
          </div>

          <form onSubmit={handleLogin} className="space-y-3.5">
            <div>
              <label className="block text-[10px] font-mono uppercase text-zinc-400 mb-1">
                Platform Master Password
              </label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  required
                  placeholder="Master key"
                  className="field-input text-xs font-mono pr-10"
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

            {loginError && (
              <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-medium text-rose-700">
                {loginError}
              </div>
            )}

            <button
              type="submit"
              disabled={loadingLogin}
              className="btn-primary w-full py-2.5 text-xs font-semibold mt-2"
            >
              {loadingLogin ? "Authenticating..." : "Access Platform Console →"}
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
        <section className="surface-card p-5 sm:p-7">
          <div className="flex items-center gap-2">
            <span className="pill-chip">Super Admin</span>
          </div>
          <h1 className="page-title mt-2">Club Application Governance</h1>
          <p className="page-subtitle">
            Review incoming club onboarding applications, verify administrative credentials, and grant portal access.
          </p>
        </section>

        {msg && (
          <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-xs font-medium text-rose-700">
            {msg}
          </div>
        )}

        {/* Filter Controls & Search */}
        <section className="surface-card space-y-4 p-4 sm:p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            {/* Status Tabs */}
            <div className="grid grid-cols-2 gap-1.5 min-[480px]:flex min-[480px]:flex-wrap">
              {[
                { label: "Pending Review", value: "pending" as const },
                { label: "Approved", value: "approved" as const },
                { label: "Rejected", value: "rejected" as const },
                { label: "All Clubs", value: "all" as const },
              ].map((tab) => (
                <button
                  key={tab.value}
                  type="button"
                  onClick={() => setStatusFilter(tab.value)}
                  className={`min-h-10 rounded-lg px-3 py-2 text-xs font-medium transition focus:outline-none focus:ring-2 focus:ring-brand-500/20 ${
                    statusFilter === tab.value
                      ? "bg-zinc-900 text-white shadow-subtle"
                      : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200"
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
                className="field-input text-xs"
              />
            </div>
          </div>

          <div className="flex flex-col gap-2 border-t border-zinc-100 pt-3 min-[420px]:flex-row min-[420px]:items-center min-[420px]:justify-between">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-900">
              {pagination ? `${pagination.total} Applications` : "Club Registry"}
            </h2>
            <button
              onClick={() => reload()}
              className="min-h-8 self-start text-xs font-medium text-brand-600 hover:underline focus:outline-none focus:ring-2 focus:ring-brand-500/20"
            >
              Refresh Table
            </button>
          </div>

          {loadingClubs ? (
            <div className="flex flex-col items-center gap-2 p-10">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-brand-600 border-t-transparent" />
              <p className="text-xs text-zinc-400 font-mono">Loading club applications…</p>
            </div>
          ) : clubs.length === 0 ? (
            <div className="p-8 text-center text-xs text-zinc-400 font-mono rounded-lg border border-dashed border-zinc-200">
              No club records match current query parameters.
            </div>
          ) : (
            <div className="space-y-3">
              {clubs.map((c) => (
                <div
                  key={c._id}
                  className="surface-card p-4 sm:p-5 transition hover:border-zinc-300"
                >
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0 text-xs">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="break-words font-sans text-sm font-bold text-zinc-900">{c.name}</span>
                        {c.status === "approved" ? (
                          <span className="badge-approved">
                            Approved
                          </span>
                        ) : c.status === "rejected" ? (
                          <span className="badge-rejected">
                            Rejected
                          </span>
                        ) : (
                          <span className="badge-pending">
                            Pending Review
                          </span>
                        )}
                      </div>
                      <p className="mt-1 break-all font-mono text-[11px] text-zinc-500">
                        URL Slug: <span className="font-semibold text-zinc-900">/register/{c.slug}</span>
                      </p>
                      <p className="mt-0.5 break-all text-zinc-500 font-mono text-[11px]">
                        Admin Email: <span className="text-zinc-700">{c.email}</span>
                      </p>
                      <p className="mt-0.5 text-[10px] text-zinc-400 font-mono">
                        Applied: {new Date(c.createdAt).toLocaleDateString()}
                      </p>
                    </div>

                    <div className="grid grid-cols-1 gap-2 min-[420px]:grid-cols-2 sm:flex sm:shrink-0 sm:items-center">
                      {c.status !== "approved" && (
                        <button
                          disabled={busyId === c._id}
                          onClick={() => handleApprove(c._id)}
                          className="btn-primary px-3 py-2 text-xs"
                        >
                          {busyId === c._id ? "Processing..." : "✓ Approve Club"}
                        </button>
                      )}
                      {c.status !== "rejected" && (
                        <button
                          disabled={busyId === c._id}
                          onClick={() => setRejectModal({ isOpen: true, club: c })}
                          className="inline-flex min-h-10 items-center justify-center rounded-lg border border-rose-200 bg-white px-3 py-2 text-xs font-medium text-rose-600 transition hover:bg-rose-50 focus:outline-none focus:ring-2 focus:ring-rose-500/20 disabled:opacity-50"
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
            <div className="flex flex-col gap-3 border-t border-zinc-100 pt-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-xs font-mono text-zinc-400">
                Page <span className="font-bold text-zinc-900">{pagination.page}</span> of{" "}
                <span className="font-bold text-zinc-900">{pagination.totalPages}</span>
              </p>
              <div className="grid grid-cols-2 gap-2 sm:flex sm:items-center">
                <button
                  onClick={() => handlePageChange(page - 1)}
                  disabled={!pagination.hasPrevPage}
                  className="btn-secondary px-3 py-2 text-xs disabled:opacity-40"
                >
                  ← Prev
                </button>
                <button
                  onClick={() => handlePageChange(page + 1)}
                  disabled={!pagination.hasNextPage}
                  className="btn-secondary px-3 py-2 text-xs disabled:opacity-40"
                >
                  Next →
                </button>
              </div>
            </div>
          )}
        </section>

        {/* Custom Rejection Confirmation Modal */}
        {rejectModal.isOpen && rejectModal.club && (
          <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="reject-club-title">
            <div className="modal-panel max-w-sm space-y-4 shadow-elevated">
              <h3 id="reject-club-title" className="text-sm font-bold text-zinc-900">
                Reject Club Application
              </h3>
              <p className="break-words text-xs text-zinc-500">
                Are you sure you want to reject the application for{" "}
                <strong className="text-zinc-800">{rejectModal.club.name}</strong> ({rejectModal.club.email})?
              </p>
              <div className="flex flex-col-reverse gap-2 border-t border-zinc-100 pt-2 min-[400px]:flex-row min-[400px]:justify-end">
                <button
                  type="button"
                  onClick={() => setRejectModal({ isOpen: false, club: null })}
                  className="btn-secondary px-3 py-2 text-xs"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={confirmRejection}
                  disabled={busyId === rejectModal.club._id}
                  className="inline-flex min-h-10 items-center justify-center rounded-lg bg-rose-600 px-3.5 py-2 text-xs font-semibold text-white shadow-subtle transition hover:bg-rose-700 focus:outline-none focus:ring-2 focus:ring-rose-500/30"
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
