"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import Link from "next/link";

export default function PRHeader({ code }: { code: string }) {
  const router = useRouter();
  const [loggingOut, setLoggingOut] = useState(false);

  async function handleLogout() {
    setLoggingOut(true);
    try {
      await fetch("/api/logout", { method: "POST" });
      router.push("/pr?logout=1");
      router.refresh();
    } catch (_err) {
      router.push("/pr");
    } finally {
      setLoggingOut(false);
    }
  }

  return (
    <header className="sticky top-0 z-40 w-full border-b border-zinc-200/80 bg-white/85 backdrop-blur-md">
      <div className="mx-auto flex min-h-14 max-w-6xl flex-wrap items-center justify-between gap-2 px-3 py-2 sm:px-6 lg:px-8">
        <Link href="/pr/dashboard" className="group flex min-w-0 shrink-0 items-center gap-2.5">
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-zinc-950 text-xs font-mono font-bold text-white shadow-subtle transition group-hover:bg-brand-600">
            Z
          </div>
          <div className="flex min-w-0 items-baseline gap-1.5">
            <span className="font-sans text-sm font-semibold tracking-tight text-zinc-900">
              Zephyr
            </span>
            <span className="hidden font-mono text-[10px] font-medium uppercase tracking-wider text-zinc-400 min-[360px]:inline">
              PR Member
            </span>
          </div>
        </Link>
        <div className="flex min-w-0 flex-1 flex-wrap items-center justify-end gap-2 sm:flex-none sm:gap-3">
          {code && (
            <div className="flex min-h-9 min-w-0 items-center gap-1.5 rounded-lg border border-brand-200/80 bg-brand-50/70 px-2.5 py-1 text-xs font-medium text-brand-700">
              <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-brand-600 animate-pulse" />
              <span className="min-w-0 max-w-[6.5rem] sm:max-w-[10rem] truncate font-mono text-[11px]" title={`CODE: ${code}`}>
                CODE: {code}
              </span>
            </div>
          )}
          <button
            type="button"
            onClick={handleLogout}
            disabled={loggingOut}
            className="inline-flex min-h-9 shrink-0 items-center justify-center rounded-lg border border-zinc-200 bg-white px-2.5 py-1 text-xs font-medium text-zinc-600 transition hover:border-rose-200 hover:bg-rose-50 hover:text-rose-600 focus:outline-none focus:ring-2 focus:ring-rose-500/20 disabled:opacity-50"
          >
            {loggingOut ? "Signing out..." : "Sign out"}
          </button>
        </div>
      </div>
    </header>
  );
}
