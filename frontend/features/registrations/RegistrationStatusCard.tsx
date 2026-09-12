"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Copy, Check, MapPin, ExternalLink, Ticket, AlertTriangle, RefreshCw, Eye, Download, Printer } from "@/lib/icons";
import StatusIcon from "@/components/icons/StatusIcon";
import type { RegistrationStatus, EntryPassData } from "@/lib/api/types";
import { resubmitRegistration, uploadPaymentScreenshot } from "@/lib/api/registrations";
import { getEntryPass } from "@/lib/api/check-in";
import { resolveRegistrationToken } from "@/lib/registration-token";

interface RegistrationStatusCardProps {
  data: RegistrationStatus;
  isLiveConnected: boolean;
  copied: boolean;
  onCopy: () => void;
  onWhatsAppShare: () => void;
}

export function RegistrationStatusCard({
  data,
  isLiveConnected,
  copied,
  onCopy,
  onWhatsAppShare,
}: RegistrationStatusCardProps) {
  // Resubmission state
  const [showEditForm, setShowEditForm] = useState(false);
  const [studentName, setStudentName] = useState(data.studentName || "");
  const [studentPhone, setStudentPhone] = useState(data.studentPhone || "");
  const [college, setCollege] = useState(data.college || "");
  const [amount, setAmount] = useState(data.amount ? String(data.amount) : "0");
  const [utr, setUtr] = useState(data.utr || "");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const [confirmModalOpen, setConfirmModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [resubmitError, setResubmitError] = useState<string | null>(null);
  const [resubmitSuccess, setResubmitSuccess] = useState(false);

  // Entry pass QR data
  const [entryPass, setEntryPass] = useState<EntryPassData | null>(null);
  const [passLoading, setPassLoading] = useState(false);

  useEffect(() => {
    if (data.status === "approved" && data.id) {
      setPassLoading(true);
      const token = resolveRegistrationToken(data.id) || undefined;
      getEntryPass(data.id, token)
        .then((res) => setEntryPass(res))
        .catch((err) => console.warn("Could not load entry pass QR:", err.message))
        .finally(() => setPassLoading(false));
    }
  }, [data.status, data.id]);

  async function handleConfirmResubmit() {
    if (!data.id) return;
    setIsSubmitting(true);
    setResubmitError(null);

    try {
      let screenshotUrl: string | undefined;
      let screenshotPublicId: string | undefined;

      if (selectedFile) {
        const uploadRes = await uploadPaymentScreenshot(selectedFile);
        screenshotUrl = uploadRes.paymentScreenshot;
        screenshotPublicId = uploadRes.paymentScreenshotPublicId;
      }

      await resubmitRegistration(data.id, {
        studentName: studentName.trim() || undefined,
        studentPhone: studentPhone.trim() || undefined,
        college: college.trim() || undefined,
        amount: amount ? Number(amount) : undefined,
        utr: utr.trim() || undefined,
        paymentScreenshot: screenshotUrl,
        paymentScreenshotPublicId: screenshotPublicId,
      });

      setConfirmModalOpen(false);
      setShowEditForm(false);
      setResubmitSuccess(true);
    } catch (err: any) {
      setResubmitError(err.message || "Failed to resubmit corrected details. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  }

  function handleDownloadPass() {
    if (!entryPass?.qrCodeDataUrl) return;
    const a = document.createElement("a");
    a.href = entryPass.qrCodeDataUrl;
    a.download = `EntryPass-${data.regNo || data.id || "ticket"}.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }

  function handlePrintPass() {
    if (typeof window !== "undefined") {
      window.print();
    }
  }

  // Needs Correction State
  if (data.status === "needs_correction") {
    return (
      <main className="mx-auto flex min-h-screen w-full max-w-md items-center justify-center p-3 py-5 sm:p-6">
        <div className="surface-card w-full p-6 sm:p-8 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-zinc-100 pb-3">
            <StatusIcon status="needs_correction" />
            {isLiveConnected && (
              <span className="flex items-center gap-1.5 font-mono text-[10px] text-emerald-600">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" />
                LIVE STREAM
              </span>
            )}
          </div>

          <div>
            <h1 className="text-lg font-bold text-zinc-900">
              Correction Required Before Approval
            </h1>
            <p className="mt-1 break-words text-xs text-zinc-500 leading-relaxed">
              The reviewer has reviewed your registration for <strong className="text-zinc-800">{data.event?.name}</strong> and requested a correction.
            </p>
          </div>

          {/* Prominent Correction Note Display */}
          <div className="rounded-lg border border-amber-300 bg-amber-50/90 p-4 text-xs space-y-1 text-amber-900 shadow-sm">
            <div className="flex items-center gap-1.5 font-bold uppercase text-[10px] tracking-wider text-amber-800">
              <AlertTriangle size={14} className="shrink-0 text-amber-600" aria-hidden="true" />
              <span>Reviewer Correction Note</span>
            </div>
            <p className="break-words font-medium leading-relaxed">
              {data.correctionNote || "Please update your payment screenshot or UTR number."}
            </p>
          </div>

          {resubmitSuccess && (
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-800">
              ✓ Corrected details submitted successfully! Your submission is now under review.
            </div>
          )}

          {!showEditForm ? (
            <div className="space-y-2 pt-2">
              <button
                type="button"
                onClick={() => setShowEditForm(true)}
                className="btn-primary w-full py-2.5 text-xs font-semibold"
              >
                ✏️ Edit & Resubmit Payment Details
              </button>
            </div>
          ) : (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                setConfirmModalOpen(true);
              }}
              className="space-y-3 pt-2 text-xs border-t border-zinc-100"
            >
              <div>
                <label className="block text-[11px] font-medium text-zinc-700">Full Name</label>
                <input
                  type="text"
                  value={studentName}
                  onChange={(e) => setStudentName(e.target.value)}
                  className="field-input mt-1 text-xs"
                />
              </div>

              <div>
                <label className="block text-[11px] font-medium text-zinc-700">Phone Number</label>
                <input
                  type="tel"
                  value={studentPhone}
                  onChange={(e) => setStudentPhone(e.target.value)}
                  className="field-input mt-1 text-xs font-mono"
                />
              </div>

              <div>
                <label className="block text-[11px] font-medium text-zinc-700">College / Institution</label>
                <input
                  type="text"
                  value={college}
                  onChange={(e) => setCollege(e.target.value)}
                  className="field-input mt-1 text-xs"
                />
              </div>

              <div>
                <label className="block text-[11px] font-medium text-zinc-700">Amount Paid (₹)</label>
                <input
                  type="number"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="field-input mt-1 text-xs font-mono"
                />
              </div>

              <div>
                <label className="block text-[11px] font-medium text-zinc-700">UTR / Transaction Ref</label>
                <input
                  type="text"
                  value={utr}
                  onChange={(e) => setUtr(e.target.value)}
                  className="field-input mt-1 text-xs font-mono"
                />
              </div>

              <div>
                <label className="block text-[11px] font-medium text-zinc-700">
                  Update Payment Screenshot (Optional)
                </label>
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                  className="mt-1 block w-full text-xs text-zinc-500 file:mr-2 file:rounded-md file:border-0 file:bg-zinc-100 file:px-2.5 file:py-1.5 file:text-xs file:font-medium hover:file:bg-zinc-200"
                />
              </div>

              {resubmitError && (
                <div className="rounded bg-rose-50 p-2.5 text-xs text-rose-700 font-medium">
                  {resubmitError}
                </div>
              )}

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowEditForm(false)}
                  className="btn-secondary flex-1 py-2 text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="btn-primary flex-1 py-2 text-xs font-semibold"
                >
                  {isSubmitting ? "Submitting..." : "Review Changes →"}
                </button>
              </div>
            </form>
          )}

          {/* Confirm Resubmission Modal */}
          {confirmModalOpen && (
            <div className="modal-backdrop" role="dialog" aria-modal="true">
              <div className="modal-panel max-w-sm space-y-3 p-5">
                <h3 className="font-bold text-sm text-zinc-900">Confirm Resubmission</h3>
                <p className="text-xs text-zinc-600">
                  Please verify that your updated details and screenshot are clear. Are you ready to submit for review?
                </p>
                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setConfirmModalOpen(false)}
                    className="btn-secondary px-3 py-1.5 text-xs"
                  >
                    Go Back
                  </button>
                  <button
                    type="button"
                    onClick={handleConfirmResubmit}
                    disabled={isSubmitting}
                    className="btn-primary px-3 py-1.5 text-xs font-semibold"
                  >
                    {isSubmitting ? "Submitting..." : "Confirm & Send"}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>
    );
  }

  // Resubmitted state
  if (data.status === "resubmitted") {
    return (
      <main className="mx-auto flex min-h-screen w-full max-w-md items-center justify-center p-3 py-5 sm:p-6">
        <div className="surface-card w-full p-6 sm:p-8 text-center space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-zinc-100 pb-3">
            <StatusIcon status="resubmitted" />
            {isLiveConnected && (
              <span className="flex items-center gap-1.5 font-mono text-[10px] text-emerald-600">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" />
                STREAM ACTIVE
              </span>
            )}
          </div>

          <div className="py-2">
            <h1 className="text-lg font-bold text-zinc-900">
              Resubmitted — Under Review
            </h1>
            <p className="mt-1 text-xs text-zinc-500 leading-relaxed">
              Your corrected registration details have been received and are currently queued for re-verification for{" "}
              <strong className="text-zinc-800">{data.event?.name}</strong>.
            </p>
          </div>

          <div className="rounded-lg border border-indigo-200 bg-indigo-50/70 p-3.5 text-left text-xs space-y-1.5 font-mono">
            <div className="flex justify-between">
              <span className="text-zinc-500">Candidate:</span>
              <span className="text-zinc-900 font-medium">{data.studentName}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-zinc-500">Updated UTR:</span>
              <span className="text-zinc-900 font-bold">{data.utr || "Submitted"}</span>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-2 pt-2 sm:grid-cols-2">
            <button
              type="button"
              onClick={onCopy}
              className="btn-secondary py-2 text-xs font-medium"
            >
              {copied ? "✓ Copied Link" : "Copy Pass Link"}
            </button>
            <button
              type="button"
              onClick={onWhatsAppShare}
              className="btn-primary py-2 text-xs font-medium"
            >
              Share Status
            </button>
          </div>
        </div>
      </main>
    );
  }

  // Pending state
  if (data.status === "pending") {
    return (
      <main className="mx-auto flex min-h-screen w-full max-w-md items-center justify-center p-3 py-5 sm:p-6">
        <div className="surface-card w-full p-6 sm:p-8 text-center space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-zinc-100 pb-3">
            <StatusIcon status="pending" />
            {isLiveConnected && (
              <span className="flex items-center gap-1.5 font-mono text-[10px] text-emerald-600">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" />
                STREAM ACTIVE
              </span>
            )}
          </div>

          <div className="py-2">
            <h1 className="text-lg font-bold text-zinc-900">
              Payment Verification In Progress
            </h1>
            <p className="mt-1 text-xs text-zinc-500 leading-relaxed">
              Your UPI payment receipt has been received and is currently being verified by the PR team for{" "}
              <strong className="text-zinc-800">{data.event?.name}</strong>.
            </p>
          </div>

          <div className="rounded-lg border border-zinc-200 bg-zinc-50/70 p-3.5 text-left text-xs space-y-1.5 font-mono">
            <div className="flex justify-between">
              <span className="text-zinc-500">Candidate:</span>
              <span className="text-zinc-900 font-medium">{data.studentName}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-zinc-500">Event:</span>
              <span className="text-zinc-900 font-medium">{data.event?.name}</span>
            </div>
            {data.amount !== undefined && (
              <div className="flex justify-between">
                <span className="text-zinc-500">Amount:</span>
                <span className="text-zinc-900 font-bold">₹{data.amount}</span>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 gap-2 pt-2 sm:grid-cols-2">
            <button
              type="button"
              onClick={onCopy}
              className="btn-secondary py-2 text-xs font-medium"
            >
              {copied ? "✓ Copied Pass Link" : "Copy Pass Link"}
            </button>
            <button
              type="button"
              onClick={onWhatsAppShare}
              className="btn-primary py-2 text-xs font-medium"
            >
              Share Status
            </button>
          </div>
        </div>
      </main>
    );
  }

  // Rejected state
  if (data.status === "rejected") {
    const reapplyUrl = data.club?.slug
      ? `/register/${data.club.slug}?event=${data.event?.slug || ""}&email=${encodeURIComponent(data.studentEmail || "")}&name=${encodeURIComponent(data.studentName || "")}`
      : "/clubs";

    return (
      <main className="mx-auto flex min-h-screen w-full max-w-md items-center justify-center p-3 py-5 sm:p-6">
        <div className="surface-card w-full p-6 sm:p-8 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-zinc-100 pb-3">
            <span className="badge-rejected">Verification Failed</span>
            <span className="font-mono text-[10px] text-zinc-400">STATUS PASS</span>
          </div>

          <div>
            <h1 className="text-lg font-bold text-zinc-900">
              Registration Verification Failed
            </h1>
            <p className="mt-1 break-words text-xs text-zinc-500">
              The PR reviewer was unable to confirm your payment receipt for {data.event?.name}.
            </p>
          </div>

          <div className="rounded-lg border border-rose-200 bg-rose-50/70 p-3 text-xs text-rose-800 space-y-1">
            <span className="font-semibold uppercase tracking-wider text-[10px]">
              Reason Provided:
            </span>
            <p className="break-words font-medium">{data.rejectionReason || "Payment screenshot unreadable or amount mismatch"}</p>
          </div>

          <div className="space-y-2 pt-2">
            <Link
              href={reapplyUrl}
              className="btn-primary w-full py-2 text-xs font-medium block text-center"
            >
              Re-submit with Clear Screenshot →
            </Link>
          </div>
        </div>
      </main>
    );
  }

  // Approved State: Official Digital QR Entry Pass & Ticket
  const isCheckedIn = (data as any).attendanceStatus === "present";

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md items-center justify-center p-3 py-5 sm:p-6 print:p-0">
      <div className="w-full space-y-4">
        {/* Printable Pass Card */}
        <div id="official-entry-pass" className="ticket-card shadow-elevated bg-white overflow-hidden rounded-xl border border-zinc-200">
          {/* Top Header with Event Branding */}
          <div className="ticket-top bg-zinc-950 p-5 text-white flex items-start justify-between gap-3">
            <div className="min-w-0">
              <span className="inline-flex items-center rounded border border-emerald-400/40 bg-emerald-500/20 px-2 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wider text-emerald-300">
                {isCheckedIn ? "✓ Attended / Checked In" : "Official Entry Pass"}
              </span>
              <h2 className="mt-2 break-words font-sans text-lg font-bold tracking-tight text-white">
                {data.event?.name}
              </h2>
              {data.event?.venue && (
                <p className="mt-1 flex items-center gap-1 text-xs text-zinc-400 font-mono">
                  <MapPin size={12} className="text-zinc-400 shrink-0" aria-hidden="true" />
                  <span>{data.event.venue}</span>
                </p>
              )}
            </div>
            <div className="text-right shrink-0">
              <Ticket size={28} className="text-emerald-400" aria-hidden="true" />
            </div>
          </div>

          {/* QR Code Pass Section */}
          <div className="p-6 text-center bg-zinc-50/70 border-b border-dashed border-zinc-200">
            {passLoading ? (
              <div className="flex flex-col items-center justify-center py-8 space-y-2">
                <div className="h-8 w-8 animate-spin rounded-full border-2 border-brand-600 border-t-transparent" />
                <p className="text-xs text-zinc-400 font-mono">Generating secure QR pass…</p>
              </div>
            ) : entryPass?.qrCodeDataUrl ? (
              <div className="space-y-3">
                <div className="inline-block p-3 bg-white rounded-xl shadow-sm border border-zinc-200">
                  <img
                    src={entryPass.qrCodeDataUrl}
                    alt="Entry Pass QR Code"
                    className="w-48 h-48 mx-auto"
                  />
                </div>
                <div>
                  <p className="font-mono text-sm font-bold tracking-widest text-zinc-900">
                    {data.regNo || "CONFIRMED"}
                  </p>
                  <p className="text-[11px] text-zinc-500">
                    {isCheckedIn
                      ? `Checked in at ${(data as any).checkedInAt ? new Date((data as any).checkedInAt).toLocaleTimeString() : "Event"}`
                      : "Present this QR code at the venue check-in desk."}
                  </p>
                </div>
              </div>
            ) : (
              <div className="py-6 text-xs text-zinc-500">
                <p className="font-bold text-zinc-800 text-sm">{data.regNo || "CONFIRMED"}</p>
                <p className="mt-1 font-mono">Registration verified successfully.</p>
              </div>
            )}
          </div>

          {/* Attendee Details Grid */}
          <div className="p-5 space-y-2.5 bg-white text-xs">
            <div className="flex justify-between border-b border-zinc-100 py-1">
              <span className="text-zinc-400 uppercase font-mono text-[10px] tracking-wider">Attendee</span>
              <span className="font-bold text-zinc-900">{data.studentName}</span>
            </div>
            <div className="flex justify-between border-b border-zinc-100 py-1">
              <span className="text-zinc-400 uppercase font-mono text-[10px] tracking-wider">Institution</span>
              <span className="text-zinc-700">{data.college || "—"}</span>
            </div>
            <div className="flex justify-between border-b border-zinc-100 py-1">
              <span className="text-zinc-400 uppercase font-mono text-[10px] tracking-wider">Amount Paid</span>
              <span className="font-mono font-bold text-zinc-900">
                {data.amount ? `₹${data.amount}` : "Free"}
              </span>
            </div>
            {data.event?.date && (
              <div className="flex justify-between py-1">
                <span className="text-zinc-400 uppercase font-mono text-[10px] tracking-wider">Event Date</span>
                <span className="font-mono text-zinc-700">
                  {new Date(data.event.date).toLocaleDateString()}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="space-y-2 print:hidden">
          <div className="grid grid-cols-2 gap-2">
            {entryPass?.qrCodeDataUrl && (
              <button
                type="button"
                onClick={handleDownloadPass}
                className="btn-primary py-2 text-xs font-semibold flex items-center justify-center gap-1.5"
              >
                <Download size={14} aria-hidden="true" />
                <span>Save QR Image</span>
              </button>
            )}
            <button
              type="button"
              onClick={handlePrintPass}
              className="btn-secondary py-2 text-xs font-semibold flex items-center justify-center gap-1.5"
            >
              <Printer size={14} aria-hidden="true" />
              <span>Print Pass</span>
            </button>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={onCopy}
              className="btn-secondary py-2 text-xs font-medium"
            >
              {copied ? "✓ Copied Link" : "Copy Pass Link"}
            </button>
            <button
              type="button"
              onClick={onWhatsAppShare}
              className="btn-secondary py-2 text-xs font-medium text-emerald-700"
            >
              Share WhatsApp
            </button>
          </div>
        </div>
      </div>
    </main>
  );
}

export default RegistrationStatusCard;