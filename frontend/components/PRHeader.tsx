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
    <header className="border-b border-slate-200/70 bg-white/80 backdrop-blur">
      <div className="page-shell flex max-w-5xl items-center justify-between px-4 py-3 sm:py-4">
        <Link href="/pr/dashboard" className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-accent text-sm font-display font-bold text-white shadow-[0_16px_30px_-18px_rgba(255,122,26,0.9)]">
            Z
          </div>
          <div>
            <p className="font-display text-base font-semibold tracking-tight text-ink">Zephyr</p>
            <p className="text-[11px] uppercase tracking-[0.25em] text-slate-500">PR Portal</p>
          </div>
        </Link>
        <div className="flex items-center gap-3">
          {code && (
            <span className="rounded-full bg-accent/10 px-3 py-1 text-xs font-semibold text-accent">
              Code: {code}
            </span>
          )}
          <button
            type="button"
            onClick={handleLogout}
            disabled={loggingOut}
            className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-red-50 hover:border-red-200 hover:text-red-600"
          >
            {loggingOut ? "Signing out..." : "Sign out"}
          </button>
        </div>
      </div>
    </header>
  );
}
