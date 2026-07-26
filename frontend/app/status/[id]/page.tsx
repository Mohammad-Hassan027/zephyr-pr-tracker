"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { getRegistrationStatus, RegistrationStatus } from "@/lib/api";

export default function StatusPage() {
  const params = useParams<{ id: string }>();
  const [data, setData] = useState<RegistrationStatus | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let interval: ReturnType<typeof setInterval>;

    async function poll() {
      try {
        const res = await getRegistrationStatus(params.id);
        setData(res);
        if (res.status !== "pending") clearInterval(interval);
      } catch {
        setError("Registration not found");
        clearInterval(interval);
      }
    }

    poll();
    interval = setInterval(poll, 5000);
    return () => clearInterval(interval);
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
            This usually takes a few seconds.
          </p>
        </div>
      </main>
    );
  }

  if (data.status === "pending") {
    return (
      <main className="mx-auto flex min-h-screen max-w-md items-center justify-center p-4 sm:p-6">
        <div className="surface-card w-full p-8 text-center">
          <div className="mx-auto mb-4 h-12 w-12 animate-pulse rounded-full bg-accent/15" />
          <h1 className="text-xl font-semibold text-ink">
            Waiting for approval
          </h1>
          <p className="mt-2 text-sm text-slate-600">
            Your payment screenshot is being verified by the PR team. This page
            updates automatically — keep it open.
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
            {data.event.name}
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
            value={new Date(data.createdAt).toLocaleDateString()}
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
