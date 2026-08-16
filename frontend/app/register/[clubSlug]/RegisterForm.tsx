"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  checkDuplicateRegistration,
  EventItem,
  submitRegistration,
  uploadPaymentScreenshot,
} from "@/lib/api";

type ClubDetails = {
  name: string;
  slug: string;
};

export default function RegisterForm({
  club,
  events,
  clubSlug,
  initialReferralCode = "",
  initialEventSlug = "",
  initialEmail = "",
  initialName = "",
}: {
  club: ClubDetails;
  events: EventItem[];
  clubSlug: string;
  initialReferralCode?: string;
  initialEventSlug?: string;
  initialEmail?: string;
  initialName?: string;
}) {
  const router = useRouter();

  const [form, setForm] = useState({
    studentName: initialName,
    studentEmail: initialEmail,
    studentPhone: "",
    college: "",
    amount: "",
    eventSlug: initialEventSlug,
    referralCode: initialReferralCode,
  });
  const [screenshot, setScreenshot] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const previewUrlRef = useRef<string | null>(null);
  const isSubmittingRef = useRef<boolean>(false);

  const [status, setStatus] = useState<
    "idle" | "uploading" | "submitting" | "error"
  >("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const [conflictRegId, setConflictRegId] = useState<string | null>(null);

  const [duplicateCheck, setDuplicateCheck] = useState<{
    checking: boolean;
    exists: boolean;
    registrationId?: string;
    status?: string;
  }>({
    checking: false,
    exists: false,
  });

  const selectedEvent = events.find((ev) => ev.slug === form.eventSlug);

  // Auto-fill amount or update fee hint when event changes
  useEffect(() => {
    if (selectedEvent && selectedEvent.fee !== undefined && selectedEvent.fee !== null) {
      if (!form.amount || form.amount === "0") {
        setForm((prev) => ({ ...prev, amount: String(selectedEvent.fee || 0) }));
      }
    }
  }, [selectedEvent]);

  // Duplicate pre-check when email and eventSlug are entered
  useEffect(() => {
    let active = true;
    const email = form.studentEmail.trim().toLowerCase();
    const eventSlug = form.eventSlug.trim();

    if (!email || !eventSlug || !email.includes("@")) {
      setDuplicateCheck({ checking: false, exists: false });
      return;
    }

    const timer = setTimeout(async () => {
      try {
        setDuplicateCheck((prev) => ({ ...prev, checking: true }));
        const res = await checkDuplicateRegistration({
          clubSlug,
          eventSlug,
          studentEmail: email,
        });
        if (!active) return;
        if (res.exists) {
          setDuplicateCheck({
            checking: false,
            exists: true,
            registrationId: res.registrationId,
            status: res.status,
          });
        } else {
          setDuplicateCheck({ checking: false, exists: false });
        }
      } catch (_e) {
        if (active) setDuplicateCheck({ checking: false, exists: false });
      }
    }, 400);

    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [form.studentEmail, form.eventSlug, clubSlug]);

  useEffect(() => {
    return () => {
      if (previewUrlRef.current) {
        URL.revokeObjectURL(previewUrlRef.current);
      }
    };
  }, []);

  function handleFile(file: File | null) {
    if (previewUrlRef.current) {
      URL.revokeObjectURL(previewUrlRef.current);
      previewUrlRef.current = null;
    }

    setScreenshot(file);
    if (file) {
      const nextUrl = URL.createObjectURL(file);
      previewUrlRef.current = nextUrl;
      setPreview(nextUrl);
    } else {
      setPreview(null);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (isSubmittingRef.current) return;

    if (duplicateCheck.exists && duplicateCheck.registrationId) {
      router.push(`/status/${duplicateCheck.registrationId}`);
      return;
    }

    if (!screenshot) {
      setErrorMsg("Please attach your UPI payment screenshot");
      setStatus("error");
      return;
    }

    isSubmittingRef.current = true;
    setErrorMsg("");
    setConflictRegId(null);
    setStatus("uploading");

    try {
      const upload = await uploadPaymentScreenshot(screenshot);
      setStatus("submitting");
      const res = await submitRegistration({
        ...form,
        clubSlug,
        ...upload,
      });
      router.push(`/status/${res.id}`);
    } catch (err: any) {
      isSubmittingRef.current = false;
      setStatus("error");
      setErrorMsg(err instanceof Error ? err.message : "Something went wrong");
    }
  }

  const isSubmitting = status === "uploading" || status === "submitting";

  return (
    <main className="mx-auto flex min-h-screen max-w-md items-center justify-center p-4 sm:p-6">
      <div className="w-full">
        <div className="mb-5 text-center">
          <p className="pill-chip">{club.name} · Event Registration</p>
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
            <span className="mb-1 block text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
              Select Event ({club.name})
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
                  {ev.name} {ev.fee ? `(₹${ev.fee})` : "(Free)"}
                </option>
              ))}
            </select>
          </label>

          {selectedEvent && (
            <div className="rounded-2xl border border-slate-200/80 bg-slate-50/90 p-3.5 text-xs text-slate-600 space-y-1">
              <div className="flex justify-between items-center font-semibold text-ink">
                <span>{selectedEvent.name}</span>
                <span className="text-accent">
                  {selectedEvent.fee ? `₹${selectedEvent.fee}` : "Free"}
                </span>
              </div>
              {selectedEvent.venue && (
                <p className="text-slate-500">📍 Venue: {selectedEvent.venue}</p>
              )}
              {selectedEvent.date && (
                <p className="text-slate-500">
                  📅 Date: {new Date(selectedEvent.date).toLocaleDateString()}
                </p>
              )}
              {selectedEvent.description && (
                <p className="mt-1 text-slate-600 border-t border-slate-200/60 pt-1 text-[11px]">
                  {selectedEvent.description}
                </p>
              )}
            </div>
          )}

          {duplicateCheck.exists && (
            <div className="rounded-2xl border border-amber-300 bg-amber-50 p-4 text-xs text-amber-900 space-y-2">
              <p className="font-semibold">
                ⚠️ You have already submitted a registration for this event!
              </p>
              <p>
                Status: <strong className="capitalize">{duplicateCheck.status || "Pending"}</strong>
              </p>
              <Link
                href={`/status/${duplicateCheck.registrationId}`}
                className="btn-primary inline-block text-xs py-1.5 px-3"
              >
                View Your Registration Status →
              </Link>
            </div>
          )}

          <Field
            label="Referral code (optional)"
            value={form.referralCode}
            onChange={(v) => setForm({ ...form, referralCode: v })}
          />

          <div>
            <div className="flex justify-between items-center mb-1">
              <span className="block text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                Amount paid (₹)
              </span>
              {selectedEvent && selectedEvent.fee !== undefined && (
                <span className="text-xs font-medium text-accent">
                  Expected: ₹{selectedEvent.fee}
                </span>
              )}
            </div>
            <input
              type="number"
              required
              value={form.amount}
              onChange={(e) => setForm({ ...form, amount: e.target.value })}
              className="field-input"
            />
          </div>

          <label className="block">
            <span className="mb-1 block text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
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
              <Image
                src={preview}
                alt="Screenshot preview"
                width={320}
                height={160}
                unoptimized
                className="mt-3 max-h-40 w-auto rounded-2xl border border-slate-200 object-cover shadow-sm"
              />
            )}
          </label>

          {status === "error" && (
            <div className="rounded-2xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 space-y-1">
              <p>{errorMsg}</p>
              {conflictRegId && (
                <Link
                  href={`/status/${conflictRegId}`}
                  className="font-semibold text-accent hover:underline text-xs block"
                >
                  View your existing registration status →
                </Link>
              )}
            </div>
          )}

          <button
            type="submit"
            disabled={isSubmitting || (duplicateCheck.exists && !duplicateCheck.registrationId)}
            className="btn-primary w-full"
          >
            {status === "uploading"
              ? "Uploading screenshot..."
              : status === "submitting"
                ? "Submitting..."
                : duplicateCheck.exists
                  ? "View Existing Status →"
                  : "Submit for approval"}
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
