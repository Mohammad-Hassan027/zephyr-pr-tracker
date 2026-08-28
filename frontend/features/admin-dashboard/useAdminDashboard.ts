"use client";

import { useEffect, useRef, useState } from "react";
import type {
  ClubInfo,
  EventItem,
  EventStat,
  Member,
} from "./admin-dashboard.types";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

export function useAdminDashboard() {
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
    null
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

  const activeRef = useRef(true);
  const loadAbortRef = useRef<AbortController | null>(null);

  async function loadData(signal?: AbortSignal) {
    try {
      const [c, m, e, s] = await Promise.all([
        fetch("/api/admin/club", { signal }).then((r) => (r.ok ? r.json() : null)),
        fetch("/api/admin/members", { signal }).then((r) => (r.ok ? r.json() : [])),
        fetch("/api/admin/events", { signal }).then((r) => (r.ok ? r.json() : [])),
        fetch("/api/admin/registrations/stats/summary", { signal }).then((r) =>
          r.ok ? r.json() : []
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
        setTimeout(() => setShowSettingsModal(false), 1500);
      } else {
        setSettingsMsg({ type: "error", text: body.error || "Failed to save changes." });
      }
    } finally {
      setIsSaving(false);
    }
  }

  async function handleCopyMemberLink(code: string, link: string) {
    try {
      await navigator.clipboard.writeText(link);
      setCopiedMemberCode(code);
      setTimeout(() => setCopiedMemberCode(null), 2500);
    } catch (err) {
      console.error("Failed to copy link:", err);
    }
  }

  return {
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
    siteUrl: SITE_URL,
  };
}
