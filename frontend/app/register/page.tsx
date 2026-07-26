"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { EventItem, getEvents, submitRegistration } from "@/lib/api";

export default function RegisterPage() {
  return (
    <Suspense
      fallback={
        <main className="mx-auto flex min-h-screen max-w-md items-center justify-center p-4 sm:p-6">
          <div className="surface-card w-full p-8 text-center">
            <p className="pill-chip">Loading</p>
            <h1 className="mt-3 text-xl font-semibold text-ink">
              Preparing registration form
            </h1>
          </div>
        </main>
      }
    >
      <RegisterPageContent />
    </Suspense>
  );
}

function RegisterPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [events, setEvents] = useState<EventItem[]>([]);
  const [form, setForm] = useState({
    studentName: "",
    studentEmail: "",
    studentPhone: "",
    college: "",
    amount: "",
    eventSlug: "",
    referralCode: searchParams.get("ref") || "",
  });
  const [screenshot, setScreenshot] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    getEvents().then(setEvents);
  }, []);

  function handleFile(file: File | null) {
    setScreenshot(file);
    setPreview(file ? URL.createObjectURL(file) : null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!screenshot) {
      setErrorMsg("Please attach your UPI payment screenshot");
      setStatus("error");
      return;
    }
    setStatus("loading");
    try {
      const { id } = await submitRegistration({ ...form, screenshot });
      router.push(`/status/${id}`);
    } catch (err) {
      setStatus("error");
      setErrorMsg(err instanceof Error ? err.message : "Something went wrong");
    }
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-md items-center justify-center p-4 sm:p-6">
      <div className="w-full">
        <div className="mb-5 text-center">
          <p className="pill-chip">Zephyr · Fest registration</p>
          <h1 className="page-title mt-3">Register for an event</h1>
          <p className="page-subtitle">
            Pay via UPI, attach the screenshot, and submit — the PR member who
            referred you will confirm it.
          </p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="surface-card space-y-4 p-5 sm:p-6"
        >
          <Field
            label="Full name"
            required
            value={form.studentName}
            onChange={(v) => setForm({ ...form, studentName: v })}
          />
          <Field
            label="Email"
            type="email"
            required
            value={form.studentEmail}
            onChange={(v) => setForm({ ...form, studentEmail: v })}
          />
          <Field
            label="Contact number"
            value={form.studentPhone}
            onChange={(v) => setForm({ ...form, studentPhone: v })}
          />
          <Field
            label="College"
            value={form.college}
            onChange={(v) => setForm({ ...form, college: v })}
          />

          <label className="block">
            <span className="mb-1 block text-xs font-medium text-gray-500">
              Event
            </span>
            <select
              required
              value={form.eventSlug}
              onChange={(e) => setForm({ ...form, eventSlug: e.target.value })}
              className="field-input"
            >
              <option value="">Select an event</option>
              {events.map((ev) => (
                <option key={ev.slug} value={ev.slug}>
                  {ev.name}
                </option>
              ))}
            </select>
          </label>

          <Field
            label="Referral code (optional)"
            value={form.referralCode}
            onChange={(v) => setForm({ ...form, referralCode: v })}
          />
          <Field
            label="Amount paid (₹)"
            type="number"
            required
            value={form.amount}
            onChange={(v) => setForm({ ...form, amount: v })}
          />

          <label className="block">
            <span className="mb-1 block text-xs font-medium text-gray-500">
              UPI transaction screenshot
            </span>
            <input
              required
              type="file"
              accept="image/*"
              onChange={(e) => handleFile(e.target.files?.[0] || null)}
              className="field-input file:mr-3 file:rounded-full file:border-0 file:bg-accent/10 file:px-3 file:py-1.5 file:text-sm file:font-semibold file:text-accent"
            />
            {preview && (
              <img
                src={preview}
                alt="Screenshot preview"
                className="mt-3 max-h-40 rounded-2xl border border-slate-200 object-cover shadow-sm"
              />
            )}
          </label>

          {status === "error" && (
            <p className="rounded-2xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {errorMsg}
            </p>
          )}

          <button
            type="submit"
            disabled={status === "loading"}
            className="btn-primary w-full"
          >
            {status === "loading" ? "Submitting..." : "Submit for approval"}
          </button>
        </form>
      </div>
    </main>
  );
}

function Field({
  label,
  value,
  onChange,
  type = "text",
  required = false,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  required?: boolean;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
        {label}
      </span>
      <input
        type={type}
        required={required}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="field-input"
      />
    </label>
  );
}
