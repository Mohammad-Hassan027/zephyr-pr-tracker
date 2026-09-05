"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { useRegistrationStatus } from "@/features/registrations/useRegistrationStatus";
import { RegistrationStatusCard } from "@/features/registrations/RegistrationStatusCard";

import { resolveRegistrationToken } from "@/lib/registration-token";

export default function StatusPage() {
  const params = useParams<{ id: string }>();
  const { data, error, isLiveConnected } = useRegistrationStatus(params.id);

  const [copied, setCopied] = useState(false);

  function getShareUrl() {
    if (typeof window === "undefined") return "";
    let url = window.location.href;
    if (!url.includes("token=")) {
      const token = resolveRegistrationToken(params.id);
      if (token) {
        url = `${window.location.origin}/status/${params.id}#token=${token}`;
      }
    }
    return url;
  }

  function handleCopy() {
    if (typeof window !== "undefined") {
      navigator.clipboard.writeText(getShareUrl());
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }
  }

  function handleWhatsAppShare() {
    if (typeof window === "undefined" || !data) return;
    const url = getShareUrl();
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

  return (
    <RegistrationStatusCard
      data={data}
      isLiveConnected={isLiveConnected}
      copied={copied}
      onCopy={handleCopy}
      onWhatsAppShare={handleWhatsAppShare}
    />
  );
}
