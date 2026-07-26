"use client";

import { useEffect, useState } from "react";
import Header from "@/components/Header";
import PRQueue from "@/components/PRQueue";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000/api";
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

type Member = { name: string; code: string };
type EventItem = { name: string; slug: string };

export default function AdminPage() {
  const [members, setMembers] = useState<Member[]>([]);
  const [events, setEvents] = useState<EventItem[]>([]);

  const [eventForm, setEventForm] = useState({
    name: "",
    slug: "",
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

  async function loadData() {
    const [m, e] = await Promise.all([
      fetch(`${API_URL}/members`).then((r) => r.json()),
      fetch(`${API_URL}/events`).then((r) => r.json()),
    ]);
    setMembers(m);
    setEvents(e);
  }

  useEffect(() => {
    loadData();
  }, []);

  async function createEvent(e: React.FormEvent) {
    e.preventDefault();
    setMsg("");
    const res = await fetch(`${API_URL}/events`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...eventForm,
        capacity: eventForm.capacity ? Number(eventForm.capacity) : null,
      }),
    });
    if (res.ok) {
      setEventForm({ name: "", slug: "", date: "", capacity: "" });
      loadData();
    } else {
      const body = await res.json();
      setMsg(body.error || "Failed to create event");
    }
  }

  async function createMember(e: React.FormEvent) {
    e.preventDefault();
    setMsg("");
    setNewPin(null);
    const res = await fetch(`${API_URL}/members`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(memberForm),
    });
    const body = await res.json();
    if (res.ok) {
      setMemberForm({ name: "", code: "", password: "" });
      setNewPin({ code: body.code, pin: body.pin });
      loadData();
    } else {
      setMsg(body.error || "Failed to create member");
    }
  }

  return (
    <>
      <Header showNav />
      <main className="page-shell space-y-6">
        <section className="surface-card border-accent/20 bg-gradient-to-br from-accent/10 via-white to-accentAlt/10 p-5 sm:p-6">
          <p className="pill-chip">Admin control</p>
          <h1 className="page-title mt-3">Manage events and approvals</h1>
          <p className="page-subtitle">
            Create new fest opportunities, issue referral access, and keep the
            approval queue moving.
          </p>
        </section>
        {msg && (
          <p className="rounded-2xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {msg}
          </p>
        )}

        <section className="surface-card p-5 sm:p-6">
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
            <button className="btn-primary sm:col-span-2">Create event</button>
          </form>

          <ul className="mt-5 space-y-2 text-sm text-slate-600">
            {events.map((e) => (
              <li
                key={e.slug}
                className="flex items-center justify-between rounded-2xl border border-slate-200 bg-slate-50/70 px-3 py-2"
              >
                <span className="font-medium text-ink">{e.name}</span>
                <span className="font-mono text-xs text-slate-500">
                  {e.slug}
                </span>
              </li>
            ))}
          </ul>
        </section>

        <section className="surface-card p-5 sm:p-6">
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

          <div className="mt-5 space-y-3">
            {members.map((m) => {
              const link = `${SITE_URL}/register?ref=${m.code}`;
              return (
                <div
                  key={m.code}
                  className="rounded-[20px] border border-slate-200 bg-slate-50/80 p-3"
                >
                  <p className="font-semibold text-ink">
                    {m.name}{" "}
                    <span className="font-mono text-xs font-normal text-slate-500">
                      ({m.code})
                    </span>
                  </p>
                  <div className="mt-3 flex items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm">
                    <span className="truncate text-slate-600">{link}</span>
                    <button
                      className="shrink-0 rounded-full bg-accent/10 px-2.5 py-1 text-xs font-semibold text-accent transition hover:bg-accent/20"
                      onClick={() => navigator.clipboard.writeText(link)}
                    >
                      Copy
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-ink">
            All pending approvals
          </h2>
          <PRQueue />
        </section>
      </main>
    </>
  );
}
