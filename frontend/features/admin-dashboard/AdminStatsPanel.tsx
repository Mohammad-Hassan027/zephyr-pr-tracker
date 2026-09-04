import { Settings } from "@/lib/icons";
import type { ClubInfo } from "./admin-dashboard.types";

interface AdminStatsPanelProps {
  club: ClubInfo | null;
  eventCount: number;
  memberCount: number;
  onOpenSettings: () => void;
}

export function AdminStatsPanel({
  club,
  eventCount,
  memberCount,
  onOpenSettings,
}: AdminStatsPanelProps) {
  return (
    <section className="surface-card p-5 sm:p-7">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="pill-chip">Admin Workspace</span>
            {club && (
              <span className="min-w-0 break-all font-mono text-xs text-zinc-400">
                /{club.slug}
              </span>
            )}
          </div>
          <h1 className="page-title mt-2">
            {club ? `${club.name} Control Center` : "Manage events and approvals"}
          </h1>
          <p className="page-subtitle">
            Publish events, manage PR member access codes, monitor seat capacity, and process the verification queue.
          </p>
        </div>

        <div className="grid w-full grid-cols-2 gap-2 min-[480px]:flex min-[480px]:w-auto min-[480px]:items-center min-[480px]:gap-3">
          <div className="rounded-lg border border-zinc-200 bg-zinc-50/70 px-3.5 py-2 text-center">
            <p className="font-mono text-base font-bold text-zinc-900">{eventCount}</p>
            <p className="text-[10px] font-mono uppercase text-zinc-400">Events</p>
          </div>
          <div className="rounded-lg border border-zinc-200 bg-zinc-50/70 px-3.5 py-2 text-center">
            <p className="font-mono text-base font-bold text-zinc-900">{memberCount}</p>
            <p className="text-[10px] font-mono uppercase text-zinc-400">PR Members</p>
          </div>
          <button
            type="button"
            onClick={onOpenSettings}
            className="btn-secondary col-span-2 px-3 py-2 text-xs min-[480px]:col-auto"
            title="Club Settings"
          >
            <Settings size={13} className="shrink-0" aria-hidden="true" />
            Settings
          </button>
        </div>
      </div>
    </section>
  );
}
