"use client";

import { useEffect, useRef, useState } from "react";
import Header from "@/components/Header";
import PRQueue from "@/components/PRQueue";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

type Member = { _id?: string; name: string; code: string };
type EventItem = {
  _id?: string;
  name: string;
  slug: string;
  description?: string;
  venue?: string;
  fee?: number;
  date?: string;
  capacity?: number | null;
};
type EventStat = {
  eventId: string;
  name: string;
  slug: string;
  capacity: number | null;
  count: number;
};
type ClubInfo = { name: string; slug: string; email: string };

export default function AdminPage() {
  const [club, setClub] = useState<ClubInfo | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [events, setEvents] = useState<EventItem[]>([]);
  const [stats, setStats] = useState<Record<string, number>>({});

  const [eventForm, setEventForm] = useState({
    name: "",
    slug: "",
    description: "",
    venue: "",
    fee: "",
    date: "",
    capacity: "",
  });
  const [memberForm, setMemberForm] = useState({
    name: "",
    code: "",
    password: "",
  });
  const [newPin, setNewPin] = useState<{ code: string; pin: string } | null>(
    null,
  );
  const [msg, setMsg] = useState("");

  // Edit Event Modal State
  const [editEventModal, setEditEventModal] = useState<{
    isOpen: boolean;
    event: EventItem | null;
  }>({ isOpen: false, event: null });
  const [editEventForm, setEditEventForm] = useState({
    name: "",
    description: "",
    venue: "",
    fee: "",
    date: "",
    capacity: "",
  });

  // Edit Member Modal State
  const [editMemberModal, setEditMemberModal] = useState<{
    isOpen: boolean;
    member: Member | null;
  }>({ isOpen: false, member: null });
  const [editMemberName, setEditMemberName] = useState("");

  // Reset PIN Dialog Modal State
  const [resetPinResult, setResetPinResult] = useState<{
    name: string;
    code: string;
    pin: string;
  } | null>(null);

  const activeRef = useRef(true);
  const loadAbortRef = useRef<AbortController | null>(null);

  async function loadData(signal?: AbortSignal) {
    try {
      const [c, m, e, s] = await Promise.all([
        fetch("/api/admin/club", { signal }).then((r) => (r.ok ? r.json() : null)),
        fetch("/api/admin/members", { signal }).then((r) => (r.ok ? r.json() : [])),
        fetch("/api/admin/events", { signal }).then((r) => (r.ok ? r.json() : [])),
        fetch("/api/admin/registrations/stats/summary", { signal }).then((r) =>
          r.ok ? r.json() : [],
        ),
      ]);
      if (!activeRef.current || signal?.aborted) return;
      setClub(c);
      setMembers(Array.isArray(m) ? m : []);
      setEvents(Array.isArray(e) ? e : []);
      if (Array.isArray(s)) {
        const map: Record<string, number> = {};
        s.forEach((item: EventStat) => {
          map[item.slug] = item.count;
          if (item.eventId) map[item.eventId] = item.count;
        });
        setStats(map);
      }
    } catch (err) {
      if (!activeRef.current || (err instanceof DOMException && err.name === "AbortError")) return;
      setMsg("Error loading club admin data");
    }
  }

  useEffect(() => {
    activeRef.current = true;
    loadAbortRef.current?.abort();
    const controller = new AbortController();
    loadAbortRef.current = controller;
    loadData(controller.signal);
    return () => {
      activeRef.current = false;
      controller.abort();
    };
  }, []);

  function reload() {
    loadAbortRef.current?.abort();
    const controller = new AbortController();
    loadAbortRef.current = controller;
    loadData(controller.signal);
  }

  async function createEvent(e: React.FormEvent) {
    e.preventDefault();
    setMsg("");
    const res = await fetch("/api/admin/events", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...eventForm,
        fee: eventForm.fee ? Number(eventForm.fee) : 0,
        capacity: eventForm.capacity ? Number(eventForm.capacity) : null,
      }),
    });
    if (res.ok) {
      setEventForm({
        name: "",
        slug: "",
        description: "",
        venue: "",
        fee: "",
        date: "",
        capacity: "",
      });
      reload();
    } else {
      const body = await res.json();
      setMsg(body.error || "Failed to create event");
    }
  }

  function openEditEvent(ev: EventItem) {
    setEditEventForm({
      name: ev.name,
      description: ev.description || "",
      venue: ev.venue || "",
      fee: ev.fee !== undefined ? String(ev.fee) : "0",
      date: ev.date ? new Date(ev.date).toISOString().split("T")[0] : "",
      capacity: ev.capacity ? String(ev.capacity) : "",
    });
    setEditEventModal({ isOpen: true, event: ev });
  }

  async function handleSaveEvent(e: React.FormEvent) {
    e.preventDefault();
    if (!editEventModal.event?._id) return;
    const res = await fetch(`/api/admin/events/${editEventModal.event._id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...editEventForm,
        fee: editEventForm.fee ? Number(editEventForm.fee) : 0,
        capacity: editEventForm.capacity ? Number(editEventForm.capacity) : null,
      }),
    });
    if (res.ok) {
      setEditEventModal({ isOpen: false, event: null });
      reload();
    } else {
      const body = await res.json();
      alert(body.error || "Failed to update event");
    }
  }

  async function handleDeleteEvent(id?: string, name?: string) {
    if (!id) return;
    if (!confirm(`Are you sure you want to delete "${name}"?`)) return;
    const res = await fetch(`/api/admin/events/${id}`, { method: "DELETE" });
    if (res.ok) {
      reload();
    } else {
      const body = await res.json();
      alert(body.error || "Failed to delete event");
    }
  }

  async function createMember(e: React.FormEvent) {
    e.preventDefault();
    setMsg("");
    setNewPin(null);
    const res = await fetch("/api/admin/members", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(memberForm),
    });
    const body = await res.json();
    if (res.ok) {
      setMemberForm({ name: "", code: "", password: "" });
      setNewPin({ code: body.code, pin: body.pin });
      reload();
    } else {
      setMsg(body.error || "Failed to create member");
    }
  }

  function openEditMember(m: Member) {
    setEditMemberName(m.name);
    setEditMemberModal({ isOpen: true, member: m });
  }

  async function handleSaveMember(e: React.FormEvent) {
    e.preventDefault();
    if (!editMemberModal.member?._id) return;
    const res = await fetch(`/api/admin/members/${editMemberModal.member._id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: editMemberName }),
    });
    if (res.ok) {
      setEditMemberModal({ isOpen: false, member: null });
      reload();
    } else {
      const body = await res.json();
      alert(body.error || "Failed to update member");
    }
  }

  async function handleResetPin(m: Member) {
    if (!m._id) return;
    if (!confirm(`Generate a new PIN for ${m.name} (${m.code})?`)) return;
    const res = await fetch(`/api/admin/members/${m._id}/reset-pin`, {
      method: "POST",
    });
    const body = await res.json();
    if (res.ok) {
      setResetPinResult({ name: m.name, code: m.code, pin: body.pin });
    } else {
      alert(body.error || "Failed to reset PIN");
    }
  }

  async function handleDeleteMember(m: Member) {
    if (!m._id) return;
    if (!confirm(`Are you sure you want to remove ${m.name} (${m.code}) from PR members?`))
      return;
    const res = await fetch(`/api/admin/members/${m._id}`, { method: "DELETE" });
    if (res.ok) {
      reload();
    } else {
      const body = await res.json();
      alert(body.error || "Failed to delete member");
    }
  }

  return (
    <>
      <Header showNav />
      <main className="page-shell space-y-6">
        <section className="surface-card border-accent/20 bg-gradient-to-br from-accent/10 via-white to-accentAlt/10 p-5 sm:p-6">
          <p className="pill-chip">Admin control</p>
          <h1 className="page-title mt-3">
            {club ? `${club.name} Dashboard` : "Manage events and approvals"}
          </h1>
          <p className="page-subtitle">
            Create new fest opportunities, issue referral access, track seat limits, and keep the
            approval queue moving for {club ? club.name : "your club"}.
          </p>
        </section>
        {msg && (
          <p className="rounded-2xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {msg}
          </p>
        )}

        {/* Events Section */}
        <section className="surface-card p-5 sm:p-6 space-y-6">
          <div>
            <h2 className="text-lg font-semibold text-ink">New event</h2>
            <form
              onSubmit={createEvent}
              className="mt-4 grid gap-3 sm:grid-cols-2"
            >
              <input
                required
                placeholder="Name (e.g. Coding War)"
                className="field-input"
                value={eventForm.name}
                onChange={(e) =>
                  setEventForm({ ...eventForm, name: e.target.value })
                }
              />
              <input
                required
                placeholder="Slug (e.g. coding-war)"
                className="field-input"
                value={eventForm.slug}
                onChange={(e) =>
                  setEventForm({ ...eventForm, slug: e.target.value })
                }
              />
              <input
                type="number"
                placeholder="Registration Fee in ₹ (e.g. 100, 0 if free)"
                className="field-input"
                value={eventForm.fee}
                onChange={(e) =>
                  setEventForm({ ...eventForm, fee: e.target.value })
                }
              />
              <input
                placeholder="Venue / Location (e.g. Audi 2 / Online)"
                className="field-input"
                value={eventForm.venue}
                onChange={(e) =>
                  setEventForm({ ...eventForm, venue: e.target.value })
                }
              />
              <input
                type="date"
                className="field-input"
                value={eventForm.date}
                onChange={(e) =>
                  setEventForm({ ...eventForm, date: e.target.value })
                }
              />
              <input
                type="number"
                placeholder="Capacity (optional)"
                className="field-input"
                value={eventForm.capacity}
                onChange={(e) =>
                  setEventForm({ ...eventForm, capacity: e.target.value })
                }
              />
              <textarea
                placeholder="Event description / details (optional)"
                rows={2}
                className="field-input sm:col-span-2"
                value={eventForm.description}
                onChange={(e) =>
                  setEventForm({ ...eventForm, description: e.target.value })
                }
              />
              <button className="btn-primary sm:col-span-2">Create event</button>
            </form>
          </div>

          <div className="border-t border-slate-200/80 pt-5">
            <h3 className="text-base font-semibold text-ink mb-3">
              Existing Events & Live Capacities ({events.length})
            </h3>

            <div className="space-y-3">
              {events.map((e) => {
                const registeredCount = stats[e.slug] ?? (e._id ? stats[e._id] : 0) ?? 0;
                const capacity = e.capacity || null;
                const fillPercent = capacity
                  ? Math.min(100, Math.round((registeredCount / capacity) * 100))
                  : null;

                return (
                  <div
                    key={e.slug}
                    className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4 space-y-3"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-ink text-base">{e.name}</span>
                          <span className="font-mono text-xs text-slate-500">
                            /{e.slug}
                          </span>
                        </div>
                        <div className="flex flex-wrap items-center gap-2 mt-1 text-xs text-slate-500">
                          <span className="font-semibold text-accent">
                            {e.fee ? `₹${e.fee}` : "Free"}
                          </span>
                          {e.venue && <span>· 📍 {e.venue}</span>}
                          {e.date && (
                            <span>· 📅 {new Date(e.date).toLocaleDateString()}</span>
                          )}
                        </div>
                        {e.description && (
                          <p className="mt-1 text-xs text-slate-600 max-w-xl">
                            {e.description}
                          </p>
                        )}
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => openEditEvent(e)}
                          className="rounded-full border border-slate-300 bg-white px-3 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition"
                        >
                          ✏️ Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteEvent(e._id, e.name)}
                          className="rounded-full border border-red-200 bg-white px-3 py-1 text-xs font-semibold text-red-600 hover:bg-red-50 transition"
                        >
                          🗑️ Delete
                        </button>
                      </div>
                    </div>

                    {/* Capacity Progress Bar (Gap 2.4) */}
                    <div className="rounded-xl border border-slate-200/80 bg-white p-3">
                      <div className="flex justify-between items-center text-xs mb-1.5">
                        <span className="font-medium text-slate-600">
                          Confirmed Registrations:{" "}
                          <strong className="text-ink">{registeredCount}</strong>
                          {capacity ? ` / ${capacity} seats` : " (Unlimited)"}
                        </span>
                        {fillPercent !== null && (
                          <span
                            className={`font-semibold ${
                              fillPercent >= 90
                                ? "text-red-600"
                                : fillPercent >= 70
                                ? "text-amber-600"
                                : "text-emerald-600"
                            }`}
                          >
                            {fillPercent}% filled
                          </span>
                        )}
                      </div>
                      {capacity && (
                        <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
                          <div
                            className={`h-full transition-all duration-500 ${
                              fillPercent! >= 90
                                ? "bg-red-500"
                                : fillPercent! >= 70
                                ? "bg-amber-500"
                                : "bg-accent"
                            }`}
                            style={{ width: `${fillPercent}%` }}
                          />
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* PR Members Section */}
        <section className="surface-card p-5 sm:p-6 space-y-6">
          <div>
            <h2 className="text-lg font-semibold text-ink">New PR member</h2>
            <form
              onSubmit={createMember}
              className="mt-4 grid gap-3 sm:grid-cols-2"
            >
              <input
                required
                placeholder="Name"
                className="field-input"
                value={memberForm.name}
                onChange={(e) =>
                  setMemberForm({ ...memberForm, name: e.target.value })
                }
              />
              <input
                placeholder="Code (optional, auto-generated)"
                className="field-input"
                value={memberForm.code}
                onChange={(e) =>
                  setMemberForm({ ...memberForm, code: e.target.value })
                }
              />
              <input
                placeholder="PIN (optional, auto-generated)"
                className="field-input sm:col-span-2"
                value={memberForm.password}
                onChange={(e) =>
                  setMemberForm({ ...memberForm, password: e.target.value })
                }
              />
              <button className="btn-primary sm:col-span-2">Add member</button>
            </form>

            {newPin && (
              <div className="mt-4 rounded-2xl border border-accent/20 bg-accent/10 p-3 text-sm text-slate-700">
                Share these with{" "}
                <span className="font-semibold text-ink">{newPin.code}</span> —
                they log in at{" "}
                <code className="rounded bg-white/70 px-1.5 py-0.5 font-mono text-xs">
                  /pr
                </code>{" "}
                with code <strong>{newPin.code}</strong> and PIN{" "}
                <strong>{newPin.pin}</strong>. This PIN is shown only once.
              </div>
            )}
          </div>

          <div className="border-t border-slate-200/80 pt-5">
            <h3 className="text-base font-semibold text-ink mb-3">
              Active PR Members ({members.length})
            </h3>
            <div className="space-y-3">
              {members.map((m) => {
                const link = club
                  ? `${SITE_URL}/register/${club.slug}?ref=${m.code}`
                  : `${SITE_URL}/register?ref=${m.code}`;
                return (
                  <div
                    key={m.code}
                    className="rounded-[20px] border border-slate-200 bg-slate-50/80 p-4 space-y-3"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="font-semibold text-ink text-base">
                        {m.name}{" "}
                        <span className="font-mono text-xs font-normal text-slate-500">
                          ({m.code})
                        </span>
                      </p>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => openEditMember(m)}
                          className="rounded-full border border-slate-300 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition"
                        >
                          ✏️ Edit Name
                        </button>
                        <button
                          type="button"
                          onClick={() => handleResetPin(m)}
                          className="rounded-full border border-amber-300 bg-white px-2.5 py-1 text-xs font-semibold text-amber-700 hover:bg-amber-50 transition"
                        >
                          🔑 Reset PIN
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteMember(m)}
                          className="rounded-full border border-red-200 bg-white px-2.5 py-1 text-xs font-semibold text-red-600 hover:bg-red-50 transition"
                        >
                          🗑️
                        </button>
                      </div>
                    </div>

                    <div className="flex items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm">
                      <span className="truncate text-xs text-slate-600">{link}</span>
                      <button
                        className="shrink-0 rounded-full bg-accent/10 px-2.5 py-1 text-xs font-semibold text-accent transition hover:bg-accent/20"
                        onClick={() => navigator.clipboard.writeText(link)}
                      >
                        Copy Link
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* Approvals Queue */}
        <section>
          <h2 className="text-lg font-semibold text-ink">
            Pending Queue
          </h2>
          <PRQueue />
        </section>

        {/* Edit Event Modal */}
        {editEventModal.isOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm">
            <div className="surface-card w-full max-w-lg p-6 shadow-2xl space-y-4">
              <h3 className="text-lg font-semibold text-ink">
                Edit Event ({editEventModal.event?.name})
              </h3>
              <form onSubmit={handleSaveEvent} className="space-y-3">
                <div>
                  <label className="block text-xs font-semibold uppercase text-slate-500 mb-1">
                    Event Name
                  </label>
                  <input
                    required
                    value={editEventForm.name}
                    onChange={(e) =>
                      setEditEventForm({ ...editEventForm, name: e.target.value })
                    }
                    className="field-input text-sm"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold uppercase text-slate-500 mb-1">
                      Fee (₹)
                    </label>
                    <input
                      type="number"
                      value={editEventForm.fee}
                      onChange={(e) =>
                        setEditEventForm({ ...editEventForm, fee: e.target.value })
                      }
                      className="field-input text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold uppercase text-slate-500 mb-1">
                      Capacity
                    </label>
                    <input
                      type="number"
                      placeholder="Unlimited if empty"
                      value={editEventForm.capacity}
                      onChange={(e) =>
                        setEditEventForm({
                          ...editEventForm,
                          capacity: e.target.value,
                        })
                      }
                      className="field-input text-sm"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold uppercase text-slate-500 mb-1">
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
                      className="field-input text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold uppercase text-slate-500 mb-1">
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
                      className="field-input text-sm"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase text-slate-500 mb-1">
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
                    className="field-input text-sm"
                  />
                </div>

                <div className="flex gap-2 justify-end pt-2">
                  <button
                    type="button"
                    onClick={() =>
                      setEditEventModal({ isOpen: false, event: null })
                    }
                    className="btn-secondary py-1.5 px-4 text-xs"
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
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm">
            <div className="surface-card w-full max-w-sm p-6 shadow-2xl space-y-4">
              <h3 className="text-lg font-semibold text-ink">
                Edit PR Member ({editMemberModal.member?.code})
              </h3>
              <form onSubmit={handleSaveMember} className="space-y-3">
                <div>
                  <label className="block text-xs font-semibold uppercase text-slate-500 mb-1">
                    Full Name
                  </label>
                  <input
                    required
                    value={editMemberName}
                    onChange={(e) => setEditMemberName(e.target.value)}
                    className="field-input text-sm"
                    autoFocus
                  />
                </div>
                <div className="flex gap-2 justify-end pt-2">
                  <button
                    type="button"
                    onClick={() =>
                      setEditMemberModal({ isOpen: false, member: null })
                    }
                    className="btn-secondary py-1.5 px-4 text-xs"
                  >
                    Cancel
                  </button>
                  <button type="submit" className="btn-primary py-1.5 px-4 text-xs">
                    Save
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Reset PIN Result Dialog */}
        {resetPinResult && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm">
            <div className="surface-card w-full max-w-sm p-6 shadow-2xl space-y-4">
              <h3 className="text-lg font-semibold text-ink">
                🔑 New PIN Generated
              </h3>
              <p className="text-xs text-slate-600">
                A new 6-digit PIN has been assigned to{" "}
                <strong>{resetPinResult.name}</strong> ({resetPinResult.code}):
              </p>
              <div className="rounded-2xl border border-accent/30 bg-accent/10 p-4 text-center">
                <p className="text-xs uppercase tracking-wider text-slate-500">
                  New Login PIN
                </p>
                <p className="font-mono text-3xl font-bold tracking-widest text-ink mt-1">
                  {resetPinResult.pin}
                </p>
              </div>
              <p className="text-[11px] text-slate-400">
                Share this PIN directly with the member. It will not be shown again.
              </p>
              <div className="flex justify-end pt-2">
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
      </main>
    </>
  );
}
