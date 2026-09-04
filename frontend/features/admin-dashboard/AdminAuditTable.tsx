import type { ClubInfo, Member } from "./admin-dashboard.types";

interface AdminAuditTableProps {
  club: ClubInfo | null;
  members: Member[];
  memberForm: {
    name: string;
    code: string;
    password: string;
  };
  newPin: { code: string; pin: string } | null;
  copiedMemberCode: string | null;
  siteUrl: string;
  onMemberFormChange: (form: any) => void;
  onCreateMember: (e: React.FormEvent) => void;
  onOpenEditMember: (m: Member) => void;
  onResetPin: (m: Member) => void;
  onDeleteMember: (m: Member) => void;
  onCopyMemberLink: (code: string, link: string) => void;
}

export function AdminAuditTable({
  club,
  members,
  memberForm,
  newPin,
  copiedMemberCode,
  siteUrl,
  onMemberFormChange,
  onCreateMember,
  onOpenEditMember,
  onResetPin,
  onDeleteMember,
  onCopyMemberLink,
}: AdminAuditTableProps) {
  return (
    <section className="surface-card space-y-6 p-4 sm:p-6">
      <div>
        <h2 className="text-sm font-semibold uppercase tracking-wider text-zinc-900 mb-4">
          Onboard PR Member
        </h2>

        <form onSubmit={onCreateMember} className="grid gap-3 sm:grid-cols-2">
          <input
            required
            placeholder="Full Name (e.g. Aman Gupta)"
            aria-label="PR member full name"
            className="field-input text-xs"
            value={memberForm.name}
            onChange={(e) =>
              onMemberFormChange({ ...memberForm, name: e.target.value })
            }
          />
          <input
            placeholder="Referral Code (optional, e.g. AMAN12)"
            aria-label="Referral code"
            className="field-input text-xs uppercase font-mono"
            value={memberForm.code}
            onChange={(e) =>
              onMemberFormChange({ ...memberForm, code: e.target.value })
            }
          />
          <input
            placeholder="Login PIN (optional, auto-generated if empty)"
            aria-label="Login PIN"
            className="field-input text-xs font-mono sm:col-span-2"
            value={memberForm.password}
            onChange={(e) =>
              onMemberFormChange({ ...memberForm, password: e.target.value })
            }
          />
          <button className="btn-primary py-3 text-sm font-medium sm:col-span-2">
            + Add PR Member
          </button>
        </form>

        {newPin && (
          <div className="mt-4 rounded-lg border border-brand-200 bg-brand-50/70 p-3.5 text-xs text-zinc-800 space-y-1">
            <p className="font-semibold text-brand-900">Member Created Successfully:</p>
            <p className="break-words">
              Share credentials with <strong className="font-mono">{newPin.code}</strong> — they sign in at{" "}
              <code className="rounded bg-white px-1.5 py-0.5 font-mono text-xs border border-brand-200">
                /pr
              </code>{" "}
              with code <strong className="font-mono">{newPin.code}</strong> and PIN{" "}
              <strong className="font-mono text-brand-700">{newPin.pin}</strong>.
            </p>
          </div>
        )}
      </div>

      <div className="border-t border-zinc-100 pt-5">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-500 mb-3">
          PR Team Roster ({members.length})
        </h3>
        {members.length === 0 ? (
          <div className="rounded-lg border border-dashed border-zinc-200 p-6 text-center text-xs text-zinc-400">
            No PR members registered yet.
          </div>
        ) : (
          <div className="space-y-3">
            {members.map((m) => {
              const link = club
                ? `${siteUrl}/register/${club.slug}?ref=${m.code}`
                : `${siteUrl}/register?ref=${m.code}`;
              return (
                <div
                  key={m.code}
                  className="rounded-lg border border-zinc-200 bg-zinc-50/60 p-4 space-y-3 transition hover:border-zinc-300"
                >
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <p className="min-w-0 break-words text-sm font-bold text-zinc-900">
                      {m.name}{" "}
                      <span className="ml-1 inline-flex max-w-full break-all rounded border border-brand-200/60 bg-brand-50 px-1.5 py-0.5 font-mono text-xs font-semibold text-brand-700">
                        {m.code}
                      </span>
                    </p>
                    <div className="grid grid-cols-1 gap-2 min-[420px]:grid-cols-3 sm:flex sm:shrink-0 sm:items-center">
                      <button
                        type="button"
                        onClick={() => onOpenEditMember(m)}
                        className="btn-secondary px-2.5 py-2 text-xs"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => onResetPin(m)}
                        className="inline-flex min-h-10 items-center justify-center rounded-lg border border-amber-200 bg-white px-2.5 py-2 text-xs font-medium text-amber-700 transition hover:bg-amber-50 focus:outline-none focus:ring-2 focus:ring-amber-500/20"
                      >
                        Reset PIN
                      </button>
                      <button
                        type="button"
                        onClick={() => onDeleteMember(m)}
                        className="inline-flex min-h-10 items-center justify-center rounded-lg border border-rose-200 bg-white px-2.5 py-2 text-xs font-medium text-rose-600 transition hover:bg-rose-50 focus:outline-none focus:ring-2 focus:ring-rose-500/20"
                      >
                        Remove
                      </button>
                    </div>
                  </div>

                  <div className="flex flex-col gap-2 rounded-lg border border-zinc-200/80 bg-white px-3 py-2 text-xs min-[480px]:flex-row min-[480px]:items-center min-[480px]:justify-between">
                    <span className="min-w-0 break-all font-mono text-[11px] text-zinc-500">{link}</span>
                    <button
                      type="button"
                      className={`inline-flex min-h-10 shrink-0 items-center justify-center rounded px-2.5 py-2 text-xs font-mono font-medium transition focus:outline-none focus:ring-2 focus:ring-brand-500/20 ${
                        copiedMemberCode === m.code
                          ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                          : "bg-zinc-100 text-zinc-700 hover:bg-zinc-200"
                      }`}
                      onClick={() => onCopyMemberLink(m.code, link)}
                    >
                      {copiedMemberCode === m.code ? "✓ Copied" : "Copy Link"}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}
