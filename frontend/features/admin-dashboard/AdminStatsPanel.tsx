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
    <section className="surface-card p-6 sm:p-7">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <span className="pill-chip">Admin Workspace</span>
            {club && (
              <span className="font-mono text-xs text-zinc-400">
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

        <div className="flex items-center gap-3">
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
            className="btn-secondary flex items-center gap-1.5 py-2 px-3 text-xs"
            title="Club Settings"
          >
            <Settings size={13} aria-hidden="true" />
            Settings
          </button>
        </div>
      </div>
    </section>
  );
}
