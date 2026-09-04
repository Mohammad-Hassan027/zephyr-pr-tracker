"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Search } from "@/lib/icons";

export default function Header({ showNav = false }: { showNav?: boolean }) {
  const router = useRouter();
  const pathname = usePathname();
  const [loggingOut, setLoggingOut] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const logoHref = showNav ? "/dashboard" : "/clubs";

  async function handleLogout() {
    setLoggingOut(true);
    try {
      await fetch("/api/logout", { method: "POST" });
      router.push("/login?logout=1");
      router.refresh();
    } catch (_err) {
      router.push("/login");
    } finally {
      setLoggingOut(false);
    }
  }

  // Keyboard shortcut listener for ⌘K / Ctrl+K
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setSearchOpen((prev) => !prev);
      } else if (e.key === "Escape") {
        setSearchOpen(false);
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const navLinks = showNav
    ? [
        { href: "/clubs", label: "Directory" },
        { href: "/my-status", label: "Lookup" },
        { href: "/dashboard", label: "Participation" },
        { href: "/dashboard/leaderboard", label: "Leaderboard" },
        { href: "/admin", label: "Admin" },
        { href: "/admin/audit", label: "Audit" },
      ]
    : [
        { href: "/clubs", label: "Clubs Directory" },
        { href: "/my-status", label: "Lookup Status" },
      ];

  const quickNav = [
    { title: "Browse Clubs & Events", href: "/clubs", category: "Public" },
    { title: "Check Registration Status", href: "/my-status", category: "Student" },
    { title: "Club Admin Login", href: "/login", category: "Admin" },
    { title: "Register New Club", href: "/signup", category: "Admin" },
    { title: "PR Member Portal Login", href: "/pr", category: "PR Portal" },
    { title: "Platform Super Admin", href: "/platform/clubs", category: "Platform" },
  ];

  const filteredQuickNav = quickNav.filter(
    (item) =>
      item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.category.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.href.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  return (
    <>
      <header className="sticky top-0 z-40 w-full border-b border-zinc-200/80 bg-white/85 backdrop-blur-md">
        <div className="mx-auto flex min-h-14 max-w-6xl flex-wrap items-center justify-between gap-2 px-3 py-2 sm:px-6 lg:px-8">
          <div className="flex min-w-0 items-center gap-3 sm:gap-6">
            <Link href={logoHref} className="group flex shrink-0 items-center gap-2.5">
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-zinc-950 text-xs font-mono font-bold text-white shadow-subtle transition group-hover:bg-brand-600">
                Z
              </div>
              <div className="flex min-w-0 items-baseline gap-1.5">
                <span className="font-sans text-sm font-semibold tracking-tight text-zinc-900">
                  Zephyr
                </span>
                <span className="hidden font-mono text-[10px] font-medium uppercase tracking-wider text-zinc-400 min-[360px]:inline">
                  Tracker
                </span>
              </div>
            </Link>

            <nav className="hidden items-center gap-1 md:flex">
              {navLinks.map((link) => {
                const isActive = pathname === link.href;
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    className={`rounded-md px-2.5 py-1 text-xs font-medium transition ${
                      isActive
                        ? "bg-zinc-100 text-zinc-900 font-semibold"
                        : "text-zinc-500 hover:bg-zinc-50 hover:text-zinc-900"
                    }`}
                  >
                    {link.label}
                  </Link>
                );
              })}
            </nav>
          </div>

          <div className="flex min-w-0 flex-1 items-center justify-end gap-2 sm:flex-none sm:gap-3">
            <button
              type="button"
              onClick={() => setSearchOpen(true)}
              className="inline-flex min-h-9 min-w-0 items-center justify-center gap-1.5 rounded-lg border border-zinc-200 bg-zinc-50/70 px-2.5 py-1 text-xs text-zinc-500 transition hover:border-zinc-300 hover:bg-white hover:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
            >
              <span className="hidden sm:inline">Quick Jump</span>
              <span className="inline sm:hidden">Search</span>
              <span className="kbd-shortcut hidden min-[360px]:inline-flex">⌘K</span>
            </button>

            {showNav ? (
              <button
                type="button"
                onClick={handleLogout}
                disabled={loggingOut}
                className="inline-flex min-h-9 shrink-0 items-center justify-center rounded-lg border border-zinc-200 bg-white px-2.5 py-1 text-xs font-medium text-zinc-600 transition hover:border-rose-200 hover:bg-rose-50 hover:text-rose-600 focus:outline-none focus:ring-2 focus:ring-rose-500/20 disabled:opacity-50"
              >
                {loggingOut ? "Signing out..." : "Sign out"}
              </button>
            ) : (
              <Link
                href="/login"
                className="inline-flex min-h-9 shrink-0 items-center justify-center rounded-lg border border-zinc-200 bg-white px-2.5 py-1 text-xs font-medium text-zinc-700 transition hover:bg-zinc-50 hover:text-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-900/10"
              >
                Club Sign In
              </Link>
            )}
          </div>
        </div>

        {/* Mobile Sub-Navigation */}
        <div className="flex flex-wrap items-center gap-1.5 border-t border-zinc-100 px-3 py-2 md:hidden">
          {navLinks.map((link) => {
            const isActive = pathname === link.href;
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`inline-flex min-h-9 items-center rounded-md px-2.5 py-1.5 text-xs font-medium transition focus:outline-none focus:ring-2 focus:ring-brand-500/20 ${
                  isActive
                    ? "bg-zinc-900 text-white shadow-subtle"
                    : "text-zinc-600 hover:bg-zinc-100"
                }`}
              >
                {link.label}
              </Link>
            );
          })}
        </div>
      </header>

      {/* ⌘K Command Palette Modal */}
      {searchOpen && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-zinc-950/40 p-3 py-6 backdrop-blur-sm sm:p-4 sm:pt-20"
          onClick={() => setSearchOpen(false)}
          role="dialog"
          aria-modal="true"
          aria-label="Quick navigation"
        >
          <div
            className="w-full max-w-[calc(100vw-1.5rem)] sm:max-w-lg overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-elevated"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center border-b border-zinc-200 px-3.5 py-2.5">
              <Search size={14} className="text-zinc-400 mr-2 shrink-0" aria-hidden="true" />
              <input
                type="text"
                placeholder="Type a command or jump to page..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="min-w-0 flex-1 bg-transparent text-sm text-zinc-900 outline-none placeholder:text-zinc-400"
                autoFocus
              />
              <span className="kbd-shortcut shrink-0">ESC</span>
            </div>

            <div className="max-h-[70dvh] overflow-y-auto p-2 sm:max-h-72">
              <div className="px-2 py-1 font-mono text-[10px] font-medium uppercase tracking-wider text-zinc-400">
                Navigation Commands
              </div>
              {filteredQuickNav.length === 0 ? (
                <div className="p-4 text-center text-xs text-zinc-400">
                  No matching destinations found.
                </div>
              ) : (
                filteredQuickNav.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setSearchOpen(false)}
                    className="flex min-h-10 items-center justify-between gap-3 rounded-lg px-2.5 py-2 text-xs font-medium text-zinc-700 transition hover:bg-zinc-100 hover:text-zinc-900 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
                  >
                    <span className="min-w-0 truncate">{item.title}</span>
                    <span className="shrink-0 rounded border border-zinc-200/80 bg-zinc-50 px-1.5 py-0.5 font-mono text-[10px] text-zinc-400">
                      {item.category}
                    </span>
                  </Link>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
