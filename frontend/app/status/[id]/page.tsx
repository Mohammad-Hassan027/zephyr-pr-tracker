"use client";

import { useEffect, useState, useRef } from "react";
import { useParams } from "next/navigation";
import { getRegistrationStatus, RegistrationStatus } from "@/lib/api";

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

    // Fallback polling function if SSE fails or disconnects
    async function startFallbackPolling() {
      if (!activeRef.current) return;
      try {
        const res = await getRegistrationStatus(params.id);
        if (!activeRef.current) return;
        setData(res);

        if (res.status === "pending") {
          // Exponential backoff up to max 30s to prevent backend hammer
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

            // Once terminal state reached, close the stream
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

          // Check if server sent custom error payload
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

          // If SSE connection fails, fallback to polling
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

  if (error) {
    return (
      <main className="mx-auto flex min-h-screen max-w-md items-center justify-center p-4 sm:p-6">
        <div className="surface-card w-full p-8 text-center">
          <p className="pill-chip">Status</p>
          <h1 className="mt-4 text-xl font-semibold text-red-600">
            Registration not found
          </h1>
          <p className="mt-2 text-sm text-slate-600">{error}</p>
        </div>
      </main>
    );
  }

  if (!data) {
    return (
      <main className="mx-auto flex min-h-screen max-w-md items-center justify-center p-4 sm:p-6">
        <div className="surface-card w-full p-8 text-center">
          <div className="mx-auto mb-4 h-12 w-12 animate-pulse rounded-full bg-accent/10" />
          <h1 className="text-xl font-semibold text-ink">
            Checking your registration
          </h1>
          <p className="mt-2 text-sm text-slate-600">
            Connecting to live status stream...
          </p>
        </div>
      </main>
    );
  }

  if (data.status === "pending") {
    return (
      <main className="mx-auto flex min-h-screen max-w-md items-center justify-center p-4 sm:p-6">
        <div className="surface-card w-full p-8 text-center">
          <div className="relative mx-auto mb-4 flex h-12 w-12 items-center justify-center">
            <div className="absolute h-full w-full animate-ping rounded-full bg-accent/20" />
            <div className="h-8 w-8 rounded-full bg-accent/30" />
          </div>
          <div className="flex items-center justify-center gap-2">
            <h1 className="text-xl font-semibold text-ink">
              Waiting for approval
            </h1>
            {isLiveConnected && (
              <span className="flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-600">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" />
                Live
              </span>
            )}
          </div>
          <p className="mt-2 text-sm text-slate-600">
            Your payment screenshot is being verified by the PR team. This page
            updates instantly upon review — keep it open.
          </p>
        </div>
      </main>
    );
  }

  if (data.status === "rejected") {
    return (
      <main className="mx-auto flex min-h-screen max-w-md items-center justify-center p-4 sm:p-6">
        <div className="surface-card w-full p-8 text-center">
          <p className="pill-chip">Update</p>
          <h1 className="mt-4 text-xl font-semibold text-red-600">
            Registration rejected
          </h1>
          <p className="mt-2 text-sm text-slate-600">{data.rejectionReason}</p>
          <p className="mt-4 text-xs text-slate-500">
            Contact the PR team if you think this is a mistake.
          </p>
        </div>
      </main>
    );
  }

  // approved
  return (
    <main className="mx-auto flex min-h-screen max-w-md items-center justify-center p-4 sm:p-6">
      <div className="ticket-card w-full">
        <div className="ticket-top">
          <p className="text-[11px] font-semibold uppercase tracking-[0.25em] text-slate-600">
            Zephyr · Registration confirmed
          </p>
          <p className="mt-1 font-display text-xl font-semibold text-ink">
            {data.event?.name}
          </p>
        </div>
        <div className="space-y-2 bg-white p-5 text-sm">
          <Row label="Reg No" value={data.regNo || "—"} bold />
          <Row label="Name" value={data.studentName} />
          <Row label="College" value={data.college || "—"} />
          <Row label="Contact" value={data.studentPhone || data.studentEmail} />
          <Row label="Amount" value={data.amount ? `₹${data.amount}` : "—"} />
          <Row
            label="Date"
            value={data.createdAt ? new Date(data.createdAt).toLocaleDateString() : "—"}
          />
        </div>
      </div>
    </main>
  );
}

function Row({
  label,
  value,
  bold = false,
}: {
  label: string;
  value: string;
  bold?: boolean;
}) {
  return (
    <div className="flex justify-between gap-3 border-b border-dashed border-slate-200 py-2 last:border-0">
      <span className="text-slate-500">{label}</span>
      <span className={bold ? "font-semibold text-accent" : "text-slate-700"}>
        {value}
      </span>
    </div>
  );
}
