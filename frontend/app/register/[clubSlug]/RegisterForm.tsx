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
    utr: "",
    eventSlug: initialEventSlug,
    referralCode: initialReferralCode,
  });
  const [screenshot, setScreenshot] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const previewUrlRef = useRef<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
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
    // Always revoke any previous preview URL to prevent memory leaks
    if (previewUrlRef.current) {
      URL.revokeObjectURL(previewUrlRef.current);
      previewUrlRef.current = null;
    }

    // No file selected (e.g. user cancelled the picker) — clear state gracefully
    if (!file) {
      setScreenshot(null);
      setPreview(null);
      return;
    }

    // Validate MIME type
    if (!file.type.startsWith("image/")) {
      setScreenshot(null);
      setPreview(null);
      setErrorMsg("Please upload a valid image file (PNG, JPG, or JPEG).");
      setStatus("error");
      return;
    }

    // Validate file size (max 5 MB)
    const MAX_SIZE_BYTES = 5 * 1024 * 1024; // 5,242,880 bytes
    if (file.size > MAX_SIZE_BYTES) {
      setScreenshot(null);
      setPreview(null);
      setErrorMsg("File is too large. Please upload a screenshot smaller than 5MB.");
      setStatus("error");
      return;
    }

    // Validation passed — create preview and store file
    // Clear any previous error that may have been set by a prior failed selection
    if (status === "error") {
      setErrorMsg("");
      setStatus("idle");
    }
    const nextUrl = URL.createObjectURL(file);
    previewUrlRef.current = nextUrl;
    setScreenshot(file);
    setPreview(nextUrl);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (isSubmittingRef.current) return;

    if (duplicateCheck.exists && duplicateCheck.registrationId) {
      router.push(`/status/${duplicateCheck.registrationId}`);
      return;
    }

    if (!screenshot) {
      setErrorMsg("Please attach your UPI payment screenshot proof");
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
      setErrorMsg(err instanceof Error ? err.message : "Submission failed. Please verify fields and try again.");
    }
  }

  const isSubmitting = status === "uploading" || status === "submitting";

  return (
    <main className="mx-auto flex min-h-screen max-w-xl items-center justify-center p-4 sm:p-6 lg:p-8">
      <div className="w-full space-y-5">
        <div className="surface-card p-6 sm:p-7">
          <div className="flex items-center justify-between gap-2">
            <span className="pill-chip">{club.name}</span>
            <Link
              href="/clubs"
              className="text-xs font-medium text-zinc-500 hover:text-zinc-900 transition"
            >
              ← Back to clubs
            </Link>
          </div>
          <h1 className="page-title mt-2">Event Registration</h1>
          <p className="page-subtitle">
            Fill in your participation details, verify the entry fee, and upload your UPI transfer receipt for instant PR verification.
          </p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="surface-card space-y-6 p-6 sm:p-7"
        >
          {/* Section 1: Participant Identity */}
          <div className="space-y-3.5">
            <div className="flex items-center gap-2 border-b border-zinc-100 pb-2">
              <span className="flex h-5 w-5 items-center justify-center rounded bg-zinc-900 text-[10px] font-mono font-bold text-white">
                1
              </span>
              <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-600">
                Participant Information
              </h2>
            </div>

            <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
              <Field
                label="Full Name"
                required
                placeholder="e.g. Rahul Sharma"
                value={form.studentName}
                onChange={(v) => setForm({ ...form, studentName: v })}
              />
              <Field
                label="Email Address"
                type="email"
                required
                placeholder="student@college.edu"
                value={form.studentEmail}
                onChange={(v) => setForm({ ...form, studentEmail: v })}
              />
              <Field
                label="WhatsApp / Phone"
                placeholder="+91 98765 43210"
                value={form.studentPhone}
                onChange={(v) => setForm({ ...form, studentPhone: v })}
              />
              <Field
                label="College / Institution"
                placeholder="e.g. MIT Pune"
                value={form.college}
                onChange={(v) => setForm({ ...form, college: v })}
              />
            </div>
          </div>

          {/* Section 2: Event Choice */}
          <div className="space-y-3.5">
            <div className="flex items-center gap-2 border-b border-zinc-100 pb-2">
              <span className="flex h-5 w-5 items-center justify-center rounded bg-zinc-900 text-[10px] font-mono font-bold text-white">
                2
              </span>
              <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-600">
                Select Event ({club.name})
              </h2>
            </div>

            {events.length === 0 ? (
              <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-4 text-center text-xs text-zinc-500 space-y-1">
                <p className="font-semibold text-zinc-700">No events available</p>
                <p>
                  {club.name} has not published any open events yet. Please
                  check back later or contact the club directly.
                </p>
              </div>
            ) : (
              <div>
                <label className="block text-xs font-medium text-zinc-500 mb-1">
                  Event Selection
                </label>
                <select
                  required
                  value={form.eventSlug}
                  onChange={(e) => setForm({ ...form, eventSlug: e.target.value })}
                  className="field-input text-sm"
                >
                  <option value="">Choose an event</option>
                  {events.map((ev) => (
                    <option key={ev.slug} value={ev.slug}>
                      {ev.name} {ev.fee ? `(₹${ev.fee})` : "(Free entry)"}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {selectedEvent && (
              <div className="rounded-lg border border-zinc-200/90 bg-zinc-50/70 p-3.5 text-xs text-zinc-600 space-y-1.5 font-sans">
                <div className="flex justify-between items-center font-semibold text-zinc-900">
                  <span>{selectedEvent.name}</span>
                  <span className="font-mono text-brand-700 bg-brand-50 border border-brand-200/60 rounded px-2 py-0.5">
                    {selectedEvent.fee ? `₹${selectedEvent.fee}` : "Free"}
                  </span>
                </div>
                <div className="flex flex-wrap gap-x-3 text-[11px] text-zinc-500 font-mono">
                  {selectedEvent.venue && <span>📍 {selectedEvent.venue}</span>}
                  {selectedEvent.date && (
                    <span>📅 {new Date(selectedEvent.date).toLocaleDateString()}</span>
                  )}
                </div>
                {selectedEvent.description && (
                  <p className="mt-1 text-[11px] text-zinc-500 border-t border-zinc-200/60 pt-1.5 leading-relaxed font-sans">
                    {selectedEvent.description}
                  </p>
                )}
              </div>
            )}

            {duplicateCheck.exists && (
              <div className="rounded-lg border border-amber-300 bg-amber-50/80 p-3.5 text-xs text-amber-900 space-y-2">
                <p className="font-semibold">
                  ⚠️ Existing registration detected for this email &amp; event!
                </p>
                <p className="text-[11px]">
                  Status: <strong className="capitalize font-mono">{duplicateCheck.status || "Pending"}</strong>
                </p>
                <Link
                  href={`/status/${duplicateCheck.registrationId}`}
                  className="btn-primary py-1 px-3 text-xs"
                >
                  View Your Status Pass →
                </Link>
              </div>
            )}
          </div>

          {/* Section 3: Referral & Payment Proof */}
          <div className="space-y-3.5">
            <div className="flex items-center gap-2 border-b border-zinc-100 pb-2">
              <span className="flex h-5 w-5 items-center justify-center rounded bg-zinc-900 text-[10px] font-mono font-bold text-white">
                3
              </span>
              <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-600">
                Payment Verification &amp; Referral
              </h2>
            </div>

            <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
              <div>
                <label className="block text-xs font-medium text-zinc-500 mb-1">
                  PR Referral Code (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. AMAN126"
                  value={form.referralCode}
                  onChange={(e) => setForm({ ...form, referralCode: e.target.value })}
                  className="field-input text-sm uppercase font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-500 mb-1">
                  UPI Ref / UTR / Txn ID (Optional)
                </label>
                <input
                  type="text"
                  placeholder="12-digit UTR number"
                  value={form.utr || ""}
                  onChange={(e) => setForm({ ...form, utr: e.target.value })}
                  className="field-input text-sm font-mono"
                />
              </div>
            </div>

            <div>
              <div className="flex justify-between items-center mb-1">
                <label className="block text-xs font-medium text-zinc-500">
                  Amount Transferred (₹)
                </label>
                {selectedEvent && selectedEvent.fee !== undefined && (
                  <span className="font-mono text-xs text-brand-600 font-medium">
                    Required: ₹{selectedEvent.fee}
                  </span>
                )}
              </div>
              <input
                type="number"
                required
                value={form.amount}
                onChange={(e) => setForm({ ...form, amount: e.target.value })}
                className="field-input text-sm font-mono"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-zinc-500 mb-1">
                UPI Payment Screenshot
              </label>
              <div className="rounded-lg border border-dashed border-zinc-300 bg-zinc-50/50 p-4 text-center">
                <input
                  ref={fileInputRef}
                  required
                  type="file"
                  accept="image/*"
                  onChange={(e) => handleFile(e.target.files?.[0] || null)}
                  className="field-input file:mr-3 file:rounded file:border-0 file:bg-zinc-900 file:px-2.5 file:py-1 file:text-xs file:font-medium file:text-white"
                />
                {preview && (
                  <div className="mt-3 flex flex-col items-center">
                    <div className="relative h-32 w-48 overflow-hidden rounded-lg border border-zinc-200 bg-zinc-900 shadow-subtle">
                      <Image
                        src={preview}
                        alt="Screenshot preview"
                        fill
                        unoptimized
                        className="object-contain"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        handleFile(null);
                        if (fileInputRef.current) fileInputRef.current.value = "";
                      }}
                      className="mt-1.5 text-xs text-rose-600 hover:underline"
                    >
                      Remove file
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>

          {status === "error" && (
            <div className="rounded-lg border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-xs font-medium text-rose-700 space-y-1">
              <p>{errorMsg}</p>
              {conflictRegId && (
                <Link
                  href={`/status/${conflictRegId}`}
                  className="font-semibold text-brand-600 hover:underline block"
                >
                  View your existing registration status →
                </Link>
              )}
            </div>
          )}

          <button
            type="submit"
            disabled={isSubmitting || (duplicateCheck.exists && !duplicateCheck.registrationId)}
            className="btn-primary w-full py-2.5 text-xs font-semibold"
          >
            {status === "uploading"
              ? "Uploading receipt..."
              : status === "submitting"
                ? "Recording registration..."
                : duplicateCheck.exists
                  ? "View Existing Status →"
                  : "Submit Registration for Verification →"}
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
  placeholder = "",
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  required?: boolean;
  placeholder?: string;
}) {
  return (
    <div>
      <label className="block text-xs font-medium text-zinc-500 mb-1">
        {label} {required && <span className="text-rose-500">*</span>}
      </label>
      <input
        type={type}
        required={required}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="field-input text-sm"
      />
    </div>
  );
}
