import Link from "next/link";

export default function Header({ showNav = false }: { showNav?: boolean }) {
  // Public nav (no admin links) → logo goes to /clubs so unauthenticated
  // visitors stay in the public area.  Admin nav → logo goes to /dashboard.
  const logoHref = showNav ? "/dashboard" : "/clubs";

  return (
    <header className="border-b border-slate-200/70 bg-white/80 backdrop-blur">
      <div className="page-shell flex max-w-5xl items-center justify-between px-0 py-3 sm:py-4">
        <Link href={logoHref} className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-accent text-sm font-display font-bold text-white shadow-[0_16px_30px_-18px_rgba(255,122,26,0.9)]">
            Z
          </div>
          <div>
            <p className="font-display text-base font-semibold tracking-tight text-ink">Zephyr</p>
            <p className="text-[11px] uppercase tracking-[0.25em] text-slate-500">PR tracker</p>
          </div>
        </Link>
        <nav className="flex flex-wrap items-center gap-2 text-sm font-semibold text-slate-600 sm:gap-4">
          <Link href="/clubs" className="rounded-full px-3 py-1.5 transition hover:bg-accent/10 hover:text-accent">
            Clubs
          </Link>
          {showNav && (
            <>
            <Link href="/dashboard" className="rounded-full px-3 py-1.5 transition hover:bg-accent/10 hover:text-accent">
              Participation
            </Link>
            <Link href="/dashboard/leaderboard" className="rounded-full px-3 py-1.5 transition hover:bg-accent/10 hover:text-accent">
              Leaderboard
            </Link>
            <Link href="/admin" className="rounded-full px-3 py-1.5 transition hover:bg-accent/10 hover:text-accent">
              Admin
            </Link>
            <Link href="/admin/audit" className="rounded-full px-3 py-1.5 transition hover:bg-accent/10 hover:text-accent">
              Audit Trail
            </Link>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}
