"use client";

import { useEffect, useRef, useState } from "react";
import Header from "@/components/Header";
import PRQueue from "@/components/PRQueue";
import {
  Calendar,
  MapPin,
  Copy,
  Check,
  Plus,
  Trash2,
  Edit,
  ShieldCheck,
  Key,
  Settings,
} from "@/lib/icons";

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
  const [copiedMemberCode, setCopiedMemberCode] = useState<string | null>(null);

  // Club Settings Modal State
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [settingsForm, setSettingsForm] = useState({
    name: "",
    currentPassword: "",
    newPassword: "",
  });
  const [isSaving, setIsSaving] = useState(false);
  const [settingsMsg, setSettingsMsg] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  async function handleCopyMemberLink(code: string, link: string) {
    try {
      await navigator.clipboard.writeText(link);
      setCopiedMemberCode(code);
      setTimeout(() => setCopiedMemberCode(null), 2500);
    } catch (err) {
      console.error("Failed to copy link:", err);
    }
  }

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

  function openSettingsModal() {
    setSettingsForm({
      name: club?.name ?? "",
      currentPassword: "",
      newPassword: "",
    });
    setSettingsMsg(null);
    setShowSettingsModal(true);
  }

  async function handleSaveSettings(e: React.FormEvent) {
    e.preventDefault();
    setSettingsMsg(null);

    if (settingsForm.newPassword && !settingsForm.currentPassword) {
      setSettingsMsg({
        type: "error",
        text: "Current password is required to set a new password.",
      });
      return;
    }

    const payload: Record<string, string> = {};
    if (settingsForm.name.trim()) payload.name = settingsForm.name.trim();
    if (settingsForm.newPassword) {
      payload.currentPassword = settingsForm.currentPassword;
      payload.newPassword = settingsForm.newPassword;
    }

    setIsSaving(true);
    try {
      const res = await fetch("/api/admin/club/update", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const body = await res.json();
      if (res.ok) {
        setSettingsMsg({ type: "success", text: "Profile updated successfully." });
        reload();
        // Auto-close after a short delay so the user sees the success message
        setTimeout(() => setShowSettingsModal(false), 1500);
      } else {
        setSettingsMsg({ type: "error", text: body.error || "Failed to save changes." });
      }
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <>
      <Header showNav />
      <main className="page-shell space-y-6">
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
                <p className="font-mono text-base font-bold text-zinc-900">{events.length}</p>
                <p className="text-[10px] font-mono uppercase text-zinc-400">Events</p>
              </div>
              <div className="rounded-lg border border-zinc-200 bg-zinc-50/70 px-3.5 py-2 text-center">
                <p className="font-mono text-base font-bold text-zinc-900">{members.length}</p>
                <p className="text-[10px] font-mono uppercase text-zinc-400">PR Members</p>
              </div>
              <button
                type="button"
                onClick={openSettingsModal}
                className="btn-secondary flex items-center gap-1.5 py-2 px-3 text-xs"
                title="Club Settings"
              >
                <Settings size={13} aria-hidden="true" />
                Settings
              </button>
            </div>
          </div>
        </section>

        {msg && (
          <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-xs font-medium text-rose-700">
            {msg}
          </div>
        )}

        {/* Events Section */}
        <section className="surface-card p-5 sm:p-6 space-y-6">
          <div>
            <div className="flex items-center justify-between border-b border-zinc-100 pb-3">
              <h2 className="text-sm font-semibold uppercase tracking-wider text-zinc-900">
                Publish New Event
              </h2>
            </div>

            <form
              onSubmit={createEvent}
              className="mt-4 grid gap-3 sm:grid-cols-2"
            >
              <input
                required
                placeholder="Event Title (e.g. Coding War)"
                className="field-input text-xs"
                value={eventForm.name}
                onChange={(e) =>
                  setEventForm({ ...eventForm, name: e.target.value })
                }
              />
              <input
                required
                placeholder="Slug (e.g. coding-war)"
                className="field-input text-xs font-mono"
                value={eventForm.slug}
                onChange={(e) =>
                  setEventForm({ ...eventForm, slug: e.target.value })
                }
              />
              <input
                type="number"
                placeholder="Registration Fee in ₹ (0 if free)"
                className="field-input text-xs font-mono"
                value={eventForm.fee}
                onChange={(e) =>
                  setEventForm({ ...eventForm, fee: e.target.value })
                }
              />
              <input
                placeholder="Venue / Location (e.g. Audi 2 / Online)"
                className="field-input text-xs"
                value={eventForm.venue}
                onChange={(e) =>
                  setEventForm({ ...eventForm, venue: e.target.value })
                }
              />
              <input
                type="date"
                className="field-input text-xs font-mono"
                value={eventForm.date}
                onChange={(e) =>
                  setEventForm({ ...eventForm, date: e.target.value })
                }
              />
              <input
                type="number"
                placeholder="Seat Capacity (leave empty for unlimited)"
                className="field-input text-xs font-mono"
                value={eventForm.capacity}
                onChange={(e) =>
                  setEventForm({ ...eventForm, capacity: e.target.value })
                }
              />
              <textarea
                placeholder="Event summary & rules (optional)"
                rows={2}
                className="field-input text-xs sm:col-span-2"
                value={eventForm.description}
                onChange={(e) =>
                  setEventForm({ ...eventForm, description: e.target.value })
                }
              />
              <button className="btn-primary sm:col-span-2 py-2 text-xs font-medium">
                + Create Event
              </button>
            </form>
          </div>

          <div className="border-t border-zinc-100 pt-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
                Active Events &amp; Capacities ({events.length})
              </h3>
            </div>

            {events.length === 0 ? (
              <div className="rounded-lg border border-dashed border-zinc-200 p-6 text-center text-xs text-zinc-400">
                No events created yet. Use the form above to publish your first event.
              </div>
            ) : (
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
                      className="rounded-lg border border-zinc-200 bg-zinc-50/60 p-4 space-y-3 transition hover:border-zinc-300"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-sans font-bold text-zinc-900 text-sm">{e.name}</span>
                            <span className="font-mono text-[11px] text-zinc-400">
                              /{e.slug}
                            </span>
                          </div>
                          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1 text-xs text-zinc-500 font-mono">
                            <span className="font-semibold text-brand-700 bg-brand-50 border border-brand-200/60 rounded px-1.5 py-0.2">
                              {e.fee ? `₹${e.fee}` : "Free"}
                            </span>
                            {e.venue && (
                              <span className="inline-flex items-center gap-1">
                                <MapPin size={11} aria-hidden="true" />
                                <span>{e.venue}</span>
                              </span>
                            )}
                            {e.date && (
                              <span className="inline-flex items-center gap-1">
                                <Calendar size={11} aria-hidden="true" />
                                <span>{new Date(e.date).toLocaleDateString()}</span>
                              </span>
                            )}
                          </div>
                          {e.description && (
                            <p className="mt-1 text-xs text-zinc-500 max-w-xl font-sans line-clamp-2">
                              {e.description}
                            </p>
                          )}
                        </div>

                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => openEditEvent(e)}
                            className="btn-secondary py-1 px-2.5 text-xs"
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteEvent(e._id, e.name)}
                            className="rounded-lg border border-rose-200 bg-white px-2.5 py-1 text-xs font-medium text-rose-600 hover:bg-rose-50 transition"
                          >
                            Delete
                          </button>
                        </div>
                      </div>

                      {/* Capacity Progress Bar */}
                      <div className="rounded-lg border border-zinc-200/80 bg-white p-3">
                        <div className="flex justify-between items-center text-xs mb-1.5 font-mono">
                          <span className="text-zinc-600">
                            Registrations:{" "}
                            <strong className="text-zinc-900">{registeredCount}</strong>
                            {capacity ? ` / ${capacity}` : " (Unlimited)"}
                          </span>
                          {fillPercent !== null && (
                            <span
                              className={`font-semibold ${
                                fillPercent >= 90
                                  ? "text-rose-600"
                                  : fillPercent >= 70
                                  ? "text-amber-600"
                                  : "text-emerald-600"
                              }`}
                            >
                              {fillPercent}% capacity
                            </span>
                          )}
                        </div>
                        {capacity && (
                          <div className="h-1.5 w-full overflow-hidden rounded-full bg-zinc-100">
                            <div
                              className={`h-full transition-all duration-500 ${
                                fillPercent! >= 90
                                  ? "bg-rose-500"
                                  : fillPercent! >= 70
                                  ? "bg-amber-500"
                                  : "bg-brand-600"
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
            )}
          </div>
        </section>

        {/* PR Members Section */}
        <section className="surface-card p-5 sm:p-6 space-y-6">
          <div>
            <div className="flex items-center justify-between border-b border-zinc-100 pb-3">
              <h2 className="text-sm font-semibold uppercase tracking-wider text-zinc-900">
                Onboard PR Member
              </h2>
            </div>

            <form
              onSubmit={createMember}
              className="mt-4 grid gap-3 sm:grid-cols-2"
            >
              <input
                required
                placeholder="Full Name (e.g. Aman Gupta)"
                className="field-input text-xs"
                value={memberForm.name}
                onChange={(e) =>
                  setMemberForm({ ...memberForm, name: e.target.value })
                }
              />
              <input
                placeholder="Referral Code (optional, e.g. AMAN12)"
                className="field-input text-xs uppercase font-mono"
                value={memberForm.code}
                onChange={(e) =>
                  setMemberForm({ ...memberForm, code: e.target.value })
                }
              />
              <input
                placeholder="Login PIN (optional, auto-generated if empty)"
                className="field-input text-xs font-mono sm:col-span-2"
                value={memberForm.password}
                onChange={(e) =>
                  setMemberForm({ ...memberForm, password: e.target.value })
                }
              />
              <button className="btn-primary sm:col-span-2 py-2 text-xs font-medium">
                + Add PR Member
              </button>
            </form>

            {newPin && (
              <div className="mt-4 rounded-lg border border-brand-200 bg-brand-50/70 p-3.5 text-xs text-zinc-800 space-y-1">
                <p className="font-semibold text-brand-900">Member Created Successfully:</p>
                <p>
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
                    ? `${SITE_URL}/register/${club.slug}?ref=${m.code}`
                    : `${SITE_URL}/register?ref=${m.code}`;
                  return (
                    <div
                      key={m.code}
                      className="rounded-lg border border-zinc-200 bg-zinc-50/60 p-4 space-y-3 transition hover:border-zinc-300"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="font-bold text-zinc-900 text-sm">
                          {m.name}{" "}
                          <span className="font-mono text-xs font-semibold text-brand-700 bg-brand-50 border border-brand-200/60 rounded px-1.5 py-0.5 ml-1">
                            {m.code}
                          </span>
                        </p>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => openEditMember(m)}
                            className="btn-secondary py-1 px-2.5 text-xs"
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => handleResetPin(m)}
                            className="rounded-lg border border-amber-200 bg-white px-2.5 py-1 text-xs font-medium text-amber-700 hover:bg-amber-50 transition"
                          >
                            Reset PIN
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteMember(m)}
                            className="rounded-lg border border-rose-200 bg-white px-2.5 py-1 text-xs font-medium text-rose-600 hover:bg-rose-50 transition"
                          >
                            Remove
                          </button>
                        </div>
                      </div>

                      <div className="flex items-center justify-between gap-3 rounded-lg border border-zinc-200/80 bg-white px-3 py-2 text-xs">
                        <span className="truncate font-mono text-[11px] text-zinc-500">{link}</span>
                        <button
                          type="button"
                          className={`shrink-0 rounded px-2.5 py-1 text-xs font-mono font-medium transition ${
                            copiedMemberCode === m.code
                              ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                              : "bg-zinc-100 text-zinc-700 hover:bg-zinc-200"
                          }`}
                          onClick={() => handleCopyMemberLink(m.code, link)}
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
                {/* Club Name */}
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

                {/* Password Change Section */}
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

                {/* Inline feedback */}
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
