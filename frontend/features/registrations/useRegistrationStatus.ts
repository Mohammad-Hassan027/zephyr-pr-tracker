"use client";

import { useEffect, useRef, useState } from "react";
import { getRegistrationStatus } from "@/lib/api/registrations";
import { resolveRegistrationToken } from "@/lib/registration-token";
import type { RegistrationStatus } from "@/lib/api/types";

type SSEState = "connecting" | "live" | "polling" | "settled";

export function useRegistrationStatus(id: string, initialToken?: string) {
  const [data, setData] = useState<RegistrationStatus | null>(null);
  const [error, setError] = useState("");
  const [sseState, setSseState] = useState<SSEState>("connecting");
  const activeRef = useRef(true);

  useEffect(() => {
    activeRef.current = true;
    const token = initialToken || resolveRegistrationToken(id) || "";
    let eventSource: EventSource | null = null;
    let fallbackPollTimer: ReturnType<typeof setTimeout> | null = null;
    let pollIntervalMs = 5000;

    async function startFallbackPolling() {
      if (!activeRef.current) return;
      setSseState("polling");
      try {
        const res = await getRegistrationStatus(id, token);
        if (!activeRef.current) return;
        setData(res);

        if (res.status === "pending") {
          pollIntervalMs = Math.min(30000, Math.floor(pollIntervalMs * 1.3));
          fallbackPollTimer = setTimeout(startFallbackPolling, pollIntervalMs);
        } else {
          setSseState("settled");
        }
      } catch {
        if (!activeRef.current) return;
        setError("Registration not found");
        setSseState("settled");
      }
    }

    function setupSSE() {
      if (typeof window === "undefined" || !window.EventSource) {
        startFallbackPolling();
        return;
      }

      try {
        const queryParams = token ? `?token=${encodeURIComponent(token)}` : "";
        const streamUrl = `/api/registrations/${id}/stream${queryParams}`;
        eventSource = new EventSource(streamUrl);

        eventSource.onopen = () => {
          if (!activeRef.current) return;
          setSseState("live");
        };

        const handleStatusEvent = (event: MessageEvent) => {
          if (!activeRef.current) return;
          try {
            const payload: RegistrationStatus = JSON.parse(event.data);
            setData(payload);

            if (payload.status !== "pending") {
              setSseState("settled");
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
          setSseState("polling");

          if (e.data) {
            try {
              const errPayload = JSON.parse(e.data);
              if (errPayload.error === "Registration not found") {
                setError("Registration not found");
                setSseState("settled");
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
  }, [id]);

  const isLiveConnected = sseState === "live";

  return { data, error, isLiveConnected };
}
