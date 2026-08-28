import Link from "next/link";
import { Copy, Check, MapPin, ExternalLink, Ticket } from "@/lib/icons";
import StatusIcon from "@/components/icons/StatusIcon";
import type { RegistrationStatus } from "@/lib/api/types";

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
              Registration Needs Correction
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

          {/* Perforated divider look */}
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
