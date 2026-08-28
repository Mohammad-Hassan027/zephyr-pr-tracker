"use client";

import Header from "@/components/Header";
import PRQueue from "@/components/PRQueue";
import { Settings } from "@/lib/icons";
import { useAdminDashboard } from "./useAdminDashboard";
import { AdminStatsPanel } from "./AdminStatsPanel";
import { AdminLeaderboard } from "./AdminLeaderboard";
import { AdminAuditTable } from "./AdminAuditTable";

export function AdminDashboardPage() {
  const {
    club,
    members,
    events,
    stats,
    msg,
    eventForm,
    setEventForm,
    memberForm,
    setMemberForm,
    newPin,
    editEventModal,
    setEditEventModal,
    editEventForm,
    setEditEventForm,
    editMemberModal,
    setEditMemberModal,
    editMemberName,
    setEditMemberName,
    resetPinResult,
    setResetPinResult,
    copiedMemberCode,
    showSettingsModal,
    setShowSettingsModal,
    settingsForm,
    setSettingsForm,
    isSaving,
    settingsMsg,
    createEvent,
    openEditEvent,
    handleSaveEvent,
    handleDeleteEvent,
    createMember,
    openEditMember,
    handleSaveMember,
    handleResetPin,
    handleDeleteMember,
    openSettingsModal,
    handleSaveSettings,
    handleCopyMemberLink,
    siteUrl,
  } = useAdminDashboard();

  return (
    <>
      <Header showNav />
      <main className="page-shell space-y-6">
        <AdminStatsPanel
          club={club}
          eventCount={events.length}
          memberCount={members.length}
          onOpenSettings={openSettingsModal}
        />

        {msg && (
          <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-xs font-medium text-rose-700">
            {msg}
          </div>
        )}

        <AdminLeaderboard
          events={events}
          stats={stats}
          eventForm={eventForm}
          onEventFormChange={setEventForm}
          onCreateEvent={createEvent}
          onOpenEditEvent={openEditEvent}
          onDeleteEvent={handleDeleteEvent}
        />

        <AdminAuditTable
          club={club}
          members={members}
          memberForm={memberForm}
          newPin={newPin}
          copiedMemberCode={copiedMemberCode}
          siteUrl={siteUrl}
          onMemberFormChange={setMemberForm}
          onCreateMember={createMember}
          onOpenEditMember={openEditMember}
          onResetPin={handleResetPin}
          onDeleteMember={handleDeleteMember}
          onCopyMemberLink={handleCopyMemberLink}
        />

        {/* Approvals Queue */}
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-zinc-900">
              Registration Verification Queue
            </h2>
          </div>
          <PRQueue />
        </section>

        {/* Edit Event Modal */}
        {editEventModal.isOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/50 p-4 backdrop-blur-sm">
            <div className="surface-card w-full max-w-lg p-6 shadow-elevated space-y-4">
              <div className="flex items-center justify-between border-b border-zinc-100 pb-3">
                <h3 className="text-sm font-bold text-zinc-900">
                  Edit Event: {editEventModal.event?.name}
                </h3>
                <button
                  type="button"
                  onClick={() => setEditEventModal({ isOpen: false, event: null })}
                  className="text-zinc-400 hover:text-zinc-600 text-xs"
                >
                  ✕
                </button>
              </div>

              <form onSubmit={handleSaveEvent} className="space-y-3">
                <div>
                  <label className="block text-[10px] font-mono uppercase text-zinc-400 mb-1">
                    Event Title
                  </label>
                  <input
                    required
                    value={editEventForm.name}
                    onChange={(e) =>
                      setEditEventForm({ ...editEventForm, name: e.target.value })
                    }
                    className="field-input text-xs"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] font-mono uppercase text-zinc-400 mb-1">
                      Fee (₹)
                    </label>
                    <input
                      type="number"
                      value={editEventForm.fee}
                      onChange={(e) =>
                        setEditEventForm({ ...editEventForm, fee: e.target.value })
                      }
                      className="field-input text-xs font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-mono uppercase text-zinc-400 mb-1">
                      Seat Capacity
                    </label>
                    <input
                      type="number"
                      placeholder="Unlimited"
                      value={editEventForm.capacity}
                      onChange={(e) =>
                        setEditEventForm({
                          ...editEventForm,
                          capacity: e.target.value,
                        })
                      }
                      className="field-input text-xs font-mono"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] font-mono uppercase text-zinc-400 mb-1">
                      Venue
                    </label>
                    <input
                      value={editEventForm.venue}
                      onChange={(e) =>
                        setEditEventForm({
                          ...editEventForm,
                          venue: e.target.value,
                        })
                      }
                      className="field-input text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-mono uppercase text-zinc-400 mb-1">
                      Date
                    </label>
                    <input
                      type="date"
                      value={editEventForm.date}
                      onChange={(e) =>
                        setEditEventForm({
                          ...editEventForm,
                          date: e.target.value,
                        })
                      }
                      className="field-input text-xs font-mono"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-mono uppercase text-zinc-400 mb-1">
                    Description
                  </label>
                  <textarea
                    rows={2}
                    value={editEventForm.description}
                    onChange={(e) =>
                      setEditEventForm({
                        ...editEventForm,
                        description: e.target.value,
                      })
                    }
                    className="field-input text-xs"
                  />
                </div>

                <div className="flex gap-2 justify-end pt-2 border-t border-zinc-100">
                  <button
                    type="button"
                    onClick={() =>
                      setEditEventModal({ isOpen: false, event: null })
                    }
                    className="btn-secondary py-1.5 px-3 text-xs"
                  >
                    Cancel
                  </button>
                  <button type="submit" className="btn-primary py-1.5 px-4 text-xs">
                    Save Changes
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Edit Member Modal */}
        {editMemberModal.isOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/50 p-4 backdrop-blur-sm">
            <div className="surface-card w-full max-w-sm p-6 shadow-elevated space-y-4">
              <h3 className="text-sm font-bold text-zinc-900">
                Edit PR Member: {editMemberModal.member?.code}
              </h3>
              <form onSubmit={handleSaveMember} className="space-y-3">
                <div>
                  <label className="block text-[10px] font-mono uppercase text-zinc-400 mb-1">
                    Full Name
                  </label>
                  <input
                    required
                    value={editMemberName}
                    onChange={(e) => setEditMemberName(e.target.value)}
                    className="field-input text-xs"
                    autoFocus
                  />
                </div>
                <div className="flex gap-2 justify-end pt-2 border-t border-zinc-100">
                  <button
                    type="button"
                    onClick={() =>
                      setEditMemberModal({ isOpen: false, member: null })
                    }
                    className="btn-secondary py-1.5 px-3 text-xs"
                  >
                    Cancel
                  </button>
                  <button type="submit" className="btn-primary py-1.5 px-4 text-xs">
                    Save Member
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Reset PIN Result Dialog */}
        {resetPinResult && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/50 p-4 backdrop-blur-sm">
            <div className="surface-card w-full max-w-sm p-6 shadow-elevated space-y-4">
              <h3 className="text-sm font-bold text-zinc-900">
                New PIN Generated
              </h3>
              <p className="text-xs text-zinc-500">
                A new 6-digit login PIN was generated for{" "}
                <strong className="text-zinc-800">{resetPinResult.name}</strong> ({resetPinResult.code}):
              </p>
              <div className="rounded-lg border border-brand-200 bg-brand-50/70 p-4 text-center">
                <p className="text-[10px] font-mono uppercase tracking-wider text-brand-600">
                  Temporary Access PIN
                </p>
                <p className="font-mono text-2xl font-bold tracking-widest text-brand-900 mt-1">
                  {resetPinResult.pin}
                </p>
              </div>
              <p className="text-[11px] text-zinc-400 font-mono">
                Share this PIN directly with the member. It will not be displayed again.
              </p>
              <div className="flex justify-end pt-2 border-t border-zinc-100">
                <button
                  type="button"
                  onClick={() => setResetPinResult(null)}
                  className="btn-primary py-1.5 px-4 text-xs"
                >
                  Done
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Club Settings Modal */}
        {showSettingsModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/50 p-4 backdrop-blur-sm">
            <div className="surface-card w-full max-w-md p-6 shadow-elevated space-y-4">
              <div className="flex items-center justify-between border-b border-zinc-100 pb-3">
                <div className="flex items-center gap-2">
                  <Settings size={14} className="text-zinc-500" aria-hidden="true" />
                  <h3 className="text-sm font-bold text-zinc-900">Club Settings</h3>
                </div>
                <button
                  type="button"
                  onClick={() => setShowSettingsModal(false)}
                  className="text-zinc-400 hover:text-zinc-600 text-xs"
                  aria-label="Close settings"
                >
                  ✕
                </button>
              </div>

              <form onSubmit={handleSaveSettings} className="space-y-4">
                <div>
                  <label className="block text-[10px] font-mono uppercase text-zinc-400 mb-1">
                    Club Name
                  </label>
                  <input
                    required
                    value={settingsForm.name}
                    onChange={(e) =>
                      setSettingsForm({ ...settingsForm, name: e.target.value })
                    }
                    className="field-input text-xs"
                    placeholder="Your club name"
                  />
                </div>

                <div className="rounded-lg border border-zinc-200 bg-zinc-50/50 p-3 space-y-3">
                  <p className="text-[10px] font-mono uppercase text-zinc-400 tracking-wider">
                    Change Password <span className="normal-case text-zinc-300">(optional)</span>
                  </p>
                  <div>
                    <label className="block text-[10px] font-mono uppercase text-zinc-400 mb-1">
                      Current Password
                    </label>
                    <input
                      type="password"
                      value={settingsForm.currentPassword}
                      onChange={(e) =>
                        setSettingsForm({ ...settingsForm, currentPassword: e.target.value })
                      }
                      className="field-input text-xs"
                      placeholder="Required only when changing password"
                      autoComplete="current-password"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-mono uppercase text-zinc-400 mb-1">
                      New Password
                    </label>
                    <input
                      type="password"
                      value={settingsForm.newPassword}
                      onChange={(e) =>
                        setSettingsForm({ ...settingsForm, newPassword: e.target.value })
                      }
                      className="field-input text-xs"
                      placeholder="Leave blank to keep current password"
                      autoComplete="new-password"
                    />
                  </div>
                </div>

                {settingsMsg && (
                  <div
                    className={`rounded-lg border px-3 py-2 text-xs font-medium ${
                      settingsMsg.type === "success"
                        ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                        : "border-rose-200 bg-rose-50 text-rose-700"
                    }`}
                  >
                    {settingsMsg.text}
                  </div>
                )}

                <div className="flex gap-2 justify-end pt-2 border-t border-zinc-100">
                  <button
                    type="button"
                    onClick={() => setShowSettingsModal(false)}
                    className="btn-secondary py-1.5 px-3 text-xs"
                    disabled={isSaving}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="btn-primary py-1.5 px-4 text-xs disabled:opacity-60"
                    disabled={isSaving}
                  >
                    {isSaving ? "Saving…" : "Save Changes"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </main>
    </>
  );
}

export default AdminDashboardPage;
