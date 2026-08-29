"use client";

import { useState } from "react";
import Link from "next/link";
import { Copy, Check, MapPin, ExternalLink, Ticket, AlertTriangle, RefreshCw, Eye } from "@/lib/icons";
import StatusIcon from "@/components/icons/StatusIcon";
import type { RegistrationStatus } from "@/lib/api/types";
import { resubmitRegistration, uploadPaymentScreenshot } from "@/lib/api/registrations";

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

  // Needs Correction State
  if (data.status === "needs_correction") {
    return (
      <main className="mx-auto flex min-h-screen max-w-md items-center justify-center p-4 sm:p-6">
        <div className="surface-card w-full p-6 sm:p-8 space-y-4">
          <div className="flex items-center justify-between border-b border-zinc-100 pb-3">
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
            <p className="mt-1 text-xs text-zinc-500 leading-relaxed">
              The reviewer has reviewed your registration for <strong className="text-zinc-800">{data.event?.name}</strong> and requested a correction.
            </p>
          </div>

          {/* Prominent Correction Note Display */}
          <div className="rounded-lg border border-amber-300 bg-amber-50/90 p-4 text-xs space-y-1 text-amber-900 shadow-sm">
            <div className="flex items-center gap-1.5 font-bold uppercase text-[10px] tracking-wider text-amber-800">
              <AlertTriangle size={14} className="text-amber-600" aria-hidden="true" />
              <span>Reviewer Correction Note:</span>
            </div>
            <p className="font-medium leading-relaxed pl-5">
              {data.correctionNote || "Please verify your UPI reference number (UTR) or re-upload a readable payment screenshot."}
            </p>
          </div>

          {resubmitSuccess ? (
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-center text-xs space-y-2 text-emerald-900 animate-fadeIn">
              <div className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
                <Check size={18} />
              </div>
              <h3 className="font-bold text-sm text-emerald-900">Resubmitted Successfully!</h3>
              <p className="text-emerald-700">
                Your corrected details have been sent to the review queue. The status will automatically update upon approval.
              </p>
            </div>
          ) : !showEditForm ? (
            <div className="space-y-3 pt-2">
              <div className="rounded-lg border border-zinc-200 bg-zinc-50/70 p-3.5 text-left text-xs space-y-1.5 font-mono">
                <div className="flex justify-between text-zinc-500">
                  <span>Candidate:</span>
                  <span className="text-zinc-900 font-sans font-medium">{data.studentName}</span>
                </div>
                <div className="flex justify-between text-zinc-500">
                  <span>Phone:</span>
                  <span className="text-zinc-900 font-medium">{data.studentPhone || "—"}</span>
                </div>
                <div className="flex justify-between text-zinc-500">
                  <span>UTR Reference:</span>
                  <span className="text-zinc-900 font-bold">{data.utr || "—"}</span>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setShowEditForm(true)}
                className="btn-primary w-full py-2.5 text-xs font-semibold flex items-center justify-center gap-2"
              >
                <RefreshCw size={14} />
                <span>Fix & Resubmit for Review</span>
              </button>

              <button
                type="button"
                onClick={onCopy}
                className="btn-secondary w-full py-2 text-xs font-medium block text-center"
              >
                {copied ? "Copied Link" : "Copy Status Link"}
              </button>
            </div>
          ) : (
            <div className="space-y-3 pt-2 border-t border-zinc-100">
              <h2 className="text-xs font-bold text-zinc-800 uppercase tracking-wider">
                Update Corrected Details
              </h2>

              {resubmitError && (
                <div className="rounded border border-rose-200 bg-rose-50 p-2.5 text-xs text-rose-800">
                  {resubmitError}
                </div>
              )}

              <div className="space-y-2 text-left">
                <div>
                  <label className="block text-[11px] font-semibold text-zinc-600 mb-0.5">
                    Student Name
                  </label>
                  <input
                    type="text"
                    value={studentName}
                    onChange={(e) => setStudentName(e.target.value)}
                    className="field-input text-xs"
                    placeholder="Full Name"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-zinc-600 mb-0.5">
                    Phone Number
                  </label>
                  <input
                    type="text"
                    value={studentPhone}
                    onChange={(e) => setStudentPhone(e.target.value)}
                    className="field-input text-xs"
                    placeholder="10-digit Mobile Number"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-zinc-600 mb-0.5">
                    UPI UTR / Reference Number
                  </label>
                  <input
                    type="text"
                    value={utr}
                    onChange={(e) => setUtr(e.target.value)}
                    className="field-input text-xs font-mono"
                    placeholder="12-digit UTR No"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-zinc-600 mb-0.5">
                    New Payment Screenshot (Optional if only fixing UTR/text)
                  </label>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                    className="block w-full text-xs text-zinc-500 file:mr-2 file:py-1 file:px-2.5 file:rounded file:border-0 file:text-xs file:font-medium file:bg-brand-50 file:text-brand-700 hover:file:bg-brand-100"
                  />
                </div>
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowEditForm(false)}
                  className="btn-secondary flex-1 py-1.5 text-xs"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmModalOpen(true)}
                  disabled={isSubmitting}
                  className="btn-primary flex-1 py-1.5 text-xs font-semibold inline-flex items-center justify-center gap-1.5"
                >
                  {isSubmitting ? (
                    <span>Uploading...</span>
                  ) : (
                    <span>Resubmit for Review</span>
                  )}
                </button>
              </div>
            </div>
          )}

          {/* Confirmation Modal */}
          {confirmModalOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/60 p-4 backdrop-blur-sm">
              <div className="surface-card w-full max-w-sm p-5 space-y-3 shadow-popover">
                <h3 className="text-sm font-bold text-zinc-900">
                  Confirm Resubmission
                </h3>
                <p className="text-xs text-zinc-600 leading-relaxed">
                  Are you sure you want to resubmit this registration with the updated information for reviewer verification?
                </p>
                <div className="flex gap-2 justify-end pt-2 border-t border-zinc-100">
                  <button
                    type="button"
                    onClick={() => setConfirmModalOpen(false)}
                    className="btn-secondary py-1.5 px-3 text-xs"
                    disabled={isSubmitting}
                  >
                    Back
                  </button>
                  <button
                    type="button"
                    onClick={handleConfirmResubmit}
                    disabled={isSubmitting}
                    className="btn-primary py-1.5 px-3 text-xs font-semibold inline-flex items-center gap-1.5"
                  >
                    {isSubmitting ? (
                      <span className="h-3 w-3 animate-spin rounded-full border-2 border-white border-t-transparent" />
                    ) : (
                      <span>Confirm & Resubmit</span>
                    )}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>
    );
  }

  // Resubmitted / Under Review State
  if (data.status === "resubmitted" || data.status === "under_review") {
    return (
      <main className="mx-auto flex min-h-screen max-w-md items-center justify-center p-4 sm:p-6">
        <div className="surface-card w-full p-6 sm:p-8 text-center space-y-4">
          <div className="flex items-center justify-between border-b border-zinc-100 pb-3">
            <StatusIcon status={data.status} />
            {isLiveConnected && (
              <span className="flex items-center gap-1.5 font-mono text-[10px] text-emerald-600">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" />
                STREAM ACTIVE
              </span>
            )}
          </div>

          <div className="py-2">
            <h1 className="text-lg font-bold text-zinc-900">
              Corrected Submission Under Review
            </h1>
            <p className="mt-1 text-xs text-zinc-500 leading-relaxed">
              Your corrected registration details have been received and are currently queued for re-verification for{" "}
              <strong className="text-zinc-800">{data.event?.name}</strong>.
            </p>
          </div>

          <div className="rounded-lg border border-indigo-200 bg-indigo-50/70 p-3.5 text-left text-xs space-y-1.5 font-mono">
            <div className="flex justify-between text-zinc-500">
              <span>Candidate:</span>
              <span className="text-zinc-900 font-sans font-medium">{data.studentName}</span>
            </div>
            <div className="flex justify-between text-zinc-500">
              <span>Updated UTR:</span>
              <span className="text-zinc-900 font-bold">{data.utr || "Submitted"}</span>
            </div>
            {data.resubmittedAt && (
              <div className="flex justify-between text-zinc-500">
                <span>Resubmitted At:</span>
                <span className="text-zinc-700">{new Date(data.resubmittedAt).toLocaleString()}</span>
              </div>
            )}
          </div>

          <div className="pt-2 flex flex-col sm:flex-row gap-2">
            <button
              type="button"
              onClick={onCopy}
              className="btn-secondary flex-1 py-1.5 text-xs font-medium inline-flex items-center justify-center gap-1.5"
            >
              {copied ? (
                <>
                  <Check size={14} className="text-emerald-600" aria-hidden="true" />
                  <span>Copied Link</span>
                </>
              ) : (
                <>
                  <Copy size={14} aria-hidden="true" />
                  <span>Copy Pass Link</span>
                </>
              )}
            </button>
            <button
              type="button"
              onClick={onWhatsAppShare}
              className="btn-primary flex-1 py-1.5 text-xs font-medium inline-flex items-center justify-center gap-1.5"
            >
              <ExternalLink size={14} aria-hidden="true" />
              <span>Share Status</span>
            </button>
          </div>

          <p className="text-[11px] text-zinc-400 font-mono">
            This screen auto-updates as soon as the reviewer approves your corrected pass.
          </p>
        </div>
      </main>
    );
  }

  // Pending state
  if (data.status === "pending") {
    return (
      <main className="mx-auto flex min-h-screen max-w-md items-center justify-center p-4 sm:p-6">
        <div className="surface-card w-full p-6 sm:p-8 text-center space-y-4">
          <div className="flex items-center justify-between border-b border-zinc-100 pb-3">
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
            <div className="flex justify-between text-zinc-500">
              <span>Candidate:</span>
              <span className="text-zinc-900 font-sans font-medium">{data.studentName}</span>
            </div>
            <div className="flex justify-between text-zinc-500">
              <span>Event:</span>
              <span className="text-zinc-900 font-medium">{data.event?.name}</span>
            </div>
            {data.amount !== undefined && (
              <div className="flex justify-between text-zinc-500">
                <span>Amount:</span>
                <span className="text-zinc-900 font-bold">₹{data.amount}</span>
              </div>
            )}
          </div>

          <div className="pt-2 flex flex-col sm:flex-row gap-2">
            <button
              type="button"
              onClick={onCopy}
              className="btn-secondary flex-1 py-1.5 text-xs font-medium inline-flex items-center justify-center gap-1.5"
            >
              {copied ? (
                <>
                  <Check size={14} className="text-emerald-600" aria-hidden="true" />
                  <span>Copied Pass Link</span>
                </>
              ) : (
                <>
                  <Copy size={14} aria-hidden="true" />
                  <span>Copy Pass Link</span>
                </>
              )}
            </button>
            <button
              type="button"
              onClick={onWhatsAppShare}
              className="btn-primary flex-1 py-1.5 text-xs font-medium inline-flex items-center justify-center gap-1.5"
            >
              <ExternalLink size={14} aria-hidden="true" />
              <span>Share Status</span>
            </button>
          </div>

          <p className="text-[11px] text-zinc-400 font-mono">
            This screen auto-updates instantly upon PR approval.
          </p>
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
      <main className="mx-auto flex min-h-screen max-w-md items-center justify-center p-4 sm:p-6">
        <div className="surface-card w-full p-6 sm:p-8 space-y-4">
          <div className="flex items-center justify-between border-b border-zinc-100 pb-3">
            <span className="badge-rejected">Verification Failed</span>
            <span className="font-mono text-[10px] text-zinc-400">STATUS PASS</span>
          </div>

          <div>
            <h1 className="text-lg font-bold text-zinc-900">
              Registration Verification Failed
            </h1>
            <p className="mt-1 text-xs text-zinc-500">
              The PR reviewer was unable to confirm your payment receipt for {data.event?.name}.
            </p>
          </div>

          <div className="rounded-lg border border-rose-200 bg-rose-50/70 p-3 text-xs text-rose-800 space-y-1">
            <span className="font-semibold uppercase tracking-wider text-[10px]">
              Reason Provided:
            </span>
            <p className="font-medium">{data.rejectionReason || "Payment screenshot unreadable or amount mismatch"}</p>
          </div>

          <div className="space-y-2 pt-2">
            <Link
              href={reapplyUrl}
              className="btn-primary w-full py-2 text-xs font-medium block text-center"
            >
              Re-submit with Clear Screenshot →
            </Link>

            {data.club?.email && (
              <a
                href={`mailto:${data.club.email}?subject=Registration%20Inquiry%20-%20${encodeURIComponent(data.event?.name || "")}`}
                className="btn-secondary w-full py-2 text-xs font-medium block text-center"
              >
                Contact Club Admin ({data.club.email})
              </a>
            )}
          </div>
        </div>
      </main>
    );
  }

  // Approved state: Boarding-pass / Ticket
  return (
    <main className="mx-auto flex min-h-screen max-w-md items-center justify-center p-4 sm:p-6">
      <div className="w-full space-y-4">
        <div className="ticket-card shadow-elevated">
          <div className="ticket-top flex items-center justify-between">
            <div>
              <StatusIcon status="approved" showLabel={false} />
              <span className="ml-1.5 font-mono text-[10px] font-semibold uppercase tracking-wider text-emerald-700 bg-emerald-50 border border-emerald-200/60 rounded px-1.5 py-0.5">
                Confirmed Pass
              </span>
              <h2 className="mt-1.5 font-sans text-lg font-bold tracking-tight text-zinc-900">
                {data.event?.name}
              </h2>
              {data.event?.venue && (
                <p className="text-xs text-zinc-500 mt-0.5 font-mono flex items-center gap-1">
                  <MapPin size={12} className="text-zinc-400 shrink-0" aria-hidden="true" />
                  <span>{data.event.venue}</span>
                </p>
              )}
            </div>
            <div className="text-right">
              <Ticket size={28} className="text-brand-600" aria-hidden="true" />
            </div>
          </div>

          <div className="border-t border-dashed border-zinc-200" />

          <div className="p-5 space-y-3 bg-white text-xs">
            <div className="flex justify-between items-center py-1 border-b border-zinc-100">
              <span className="text-zinc-400 uppercase font-mono text-[10px] tracking-wider">
                Registration No
              </span>
              <span className="font-mono text-sm font-bold text-brand-700 bg-brand-50 border border-brand-200/60 rounded px-2 py-0.5">
                {data.regNo || "CONFIRMED"}
              </span>
            </div>

            <div className="flex justify-between items-center py-1 border-b border-zinc-100">
              <span className="text-zinc-400 uppercase font-mono text-[10px] tracking-wider">
                Student Name
              </span>
              <span className="font-medium text-zinc-900">{data.studentName}</span>
            </div>

            <div className="flex justify-between items-center py-1 border-b border-zinc-100">
              <span className="text-zinc-400 uppercase font-mono text-[10px] tracking-wider">
                College
              </span>
              <span className="text-zinc-700">{data.college || "—"}</span>
            </div>

            <div className="flex justify-between items-center py-1 border-b border-zinc-100">
              <span className="text-zinc-400 uppercase font-mono text-[10px] tracking-wider">
                Contact
              </span>
              <span className="text-zinc-700">{data.studentPhone || data.studentEmail}</span>
            </div>

            <div className="flex justify-between items-center py-1 border-b border-zinc-100">
              <span className="text-zinc-400 uppercase font-mono text-[10px] tracking-wider">
                Amount Paid
              </span>
              <span className="font-mono font-bold text-zinc-900">
                {data.amount ? `₹${data.amount}` : "Free"}
              </span>
            </div>

            <div className="flex justify-between items-center py-1">
              <span className="text-zinc-400 uppercase font-mono text-[10px] tracking-wider">
                Confirmed Date
              </span>
              <span className="font-mono text-zinc-600">
                {data.createdAt ? new Date(data.createdAt).toLocaleDateString() : "—"}
              </span>
            </div>
          </div>
        </div>

        <div className="flex gap-2 justify-center">
          <button
            type="button"
            onClick={onCopy}
            className="btn-secondary flex-1 py-2 text-xs font-medium inline-flex items-center justify-center gap-1.5"
          >
            {copied ? (
              <>
                <Check size={14} className="text-emerald-600" aria-hidden="true" />
                <span>Copied Pass Link</span>
              </>
            ) : (
              <>
                <Copy size={14} aria-hidden="true" />
                <span>Copy Ticket Link</span>
              </>
            )}
          </button>
          <button
            type="button"
            onClick={onWhatsAppShare}
            className="btn-primary flex-1 py-2 text-xs font-medium inline-flex items-center justify-center gap-1.5"
          >
            <ExternalLink size={14} aria-hidden="true" />
            <span>Share on WhatsApp</span>
          </button>
        </div>
      </div>
    </main>
  );
}
