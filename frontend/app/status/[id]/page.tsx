"use client";

import { useEffect, useState, useRef } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { getRegistrationStatus, RegistrationStatus } from "@/lib/api";
import { Copy, Check, MapPin, ExternalLink, Ticket } from "@/lib/icons";
import StatusIcon from "@/components/icons/StatusIcon";

export default function StatusPage() {
  const params = useParams<{ id: string }>();
  const [data, setData] = useState<RegistrationStatus | null>(null);
  const [error, setError] = useState("");
  const [isLiveConnected, setIsLiveConnected] = useState(false);

  const activeRef = useRef(true);

  useEffect(() => {
    activeRef.current = true;
    let eventSource: EventSource | null = null;
    let fallbackPollTimer: ReturnType<typeof setTimeout> | null = null;
    let pollIntervalMs = 5000;

    async function startFallbackPolling() {
      if (!activeRef.current) return;
      try {
        const res = await getRegistrationStatus(params.id);
        if (!activeRef.current) return;
        setData(res);

        if (res.status === "pending") {
          pollIntervalMs = Math.min(30000, Math.floor(pollIntervalMs * 1.3));
          fallbackPollTimer = setTimeout(startFallbackPolling, pollIntervalMs);
        }
      } catch {
        if (!activeRef.current) return;
        setError("Registration not found");
      }
    }

    function setupSSE() {
      if (typeof window === "undefined" || !window.EventSource) {
        startFallbackPolling();
        return;
      }

      try {
        const streamUrl = `/api/registrations/${params.id}/stream`;
        eventSource = new EventSource(streamUrl);

        eventSource.onopen = () => {
          if (!activeRef.current) return;
          setIsLiveConnected(true);
        };

        const handleStatusEvent = (event: MessageEvent) => {
          if (!activeRef.current) return;
          try {
            const payload: RegistrationStatus = JSON.parse(event.data);
            setData(payload);

            if (payload.status !== "pending") {
              setIsLiveConnected(false);
              eventSource?.close();
            }
          } catch (parseErr) {
            console.error("Failed to parse status event", parseErr);
          }
        };

        eventSource.addEventListener("status", handleStatusEvent);
        eventSource.onmessage = handleStatusEvent;

        eventSource.addEventListener("error", (e: any) => {
          if (!activeRef.current) return;
          setIsLiveConnected(false);

          if (e.data) {
            try {
              const errPayload = JSON.parse(e.data);
              if (errPayload.error === "Registration not found") {
                setError("Registration not found");
                eventSource?.close();
                return;
              }
            } catch {}
          }

          eventSource?.close();
          startFallbackPolling();
        });
      } catch {
        startFallbackPolling();
      }
    }

    setupSSE();

    return () => {
      activeRef.current = false;
      if (eventSource) {
        eventSource.close();
      }
      if (fallbackPollTimer) {
        clearTimeout(fallbackPollTimer);
      }
    };
  }, [params.id]);

  const [copied, setCopied] = useState(false);

  function handleCopy() {
    if (typeof window !== "undefined") {
      navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }
  }

  function handleWhatsAppShare() {
    if (typeof window === "undefined" || !data) return;
    const url = window.location.href;
    const text =
      data.status === "approved"
        ? `I am confirmed for ${data.event?.name}! Reg No: ${data.regNo}. Details: ${url}`
        : `Tracking my registration status for ${data.event?.name}: ${url}`;
    window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`, "_blank");
  }

  if (error) {
    return (
      <main className="mx-auto flex min-h-screen max-w-md items-center justify-center p-4 sm:p-6">
        <div className="surface-card w-full p-8 text-center space-y-3">
          <span className="pill-chip">Status 404</span>
          <h1 className="text-lg font-bold text-zinc-900">
            Registration Not Found
          </h1>
          <p className="text-xs text-zinc-500">{error}</p>
          <div className="pt-2">
            <Link href="/my-status" className="btn-primary text-xs">
              Look up with email address →
            </Link>
          </div>
        </div>
      </main>
    );
  }

  if (!data) {
    return (
      <main className="mx-auto flex min-h-screen max-w-md items-center justify-center p-4 sm:p-6">
        <div className="surface-card w-full p-8 text-center space-y-3 animate-pulse">
          <div className="mx-auto h-8 w-8 rounded-full border-2 border-brand-600 border-t-transparent animate-spin" />
          <h1 className="text-sm font-semibold text-zinc-900">
            Checking verification pass...
          </h1>
          <p className="text-xs text-zinc-400 font-mono">
            Connecting to real-time status stream
          </p>
        </div>
      </main>
    );
  }

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
              onClick={handleCopy}
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
              onClick={handleWhatsAppShare}
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
            onClick={handleCopy}
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
            onClick={handleWhatsAppShare}
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
