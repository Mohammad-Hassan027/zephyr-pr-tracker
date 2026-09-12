"use client";

import { useState, useCallback } from "react";
import { useQrScanner } from "./useQrScanner";
import {
  verifyCheckIn,
  confirmCheckIn,
  lookupAttendees,
} from "@/lib/api/check-in";
import type {
  CheckInVerificationResult,
  AttendeeLookupItem,
  EventItem,
} from "@/lib/api/types";

interface CheckInConsoleProps {
  events: EventItem[];
  clubName?: string;
}

export function CheckInConsole({ events, clubName }: CheckInConsoleProps) {
  const [selectedEventSlug, setSelectedEventSlug] = useState<string>("");
  const [activeTab, setActiveTab] = useState<"scanner" | "manual" | "lookup">("scanner");

  // ─── Manual input ──────────────────────────────────────────────────────────
  const [manualInput, setManualInput] = useState("");

  // ─── Lookup ────────────────────────────────────────────────────────────────
  const [searchQuery, setSearchQuery] = useState("");
  const [lookupResults, setLookupResults] = useState<AttendeeLookupItem[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  // ─── Verification & confirmation ──────────────────────────────────────────
  const [isVerifying, setIsVerifying] = useState(false);
  const [verificationResult, setVerificationResult] = useState<CheckInVerificationResult | null>(null);
  const [verifyError, setVerifyError] = useState<string | null>(null);

  const [isConfirming, setIsConfirming] = useState(false);
  const [confirmError, setConfirmError] = useState<string | null>(null);
  const [confirmSuccess, setConfirmSuccess] = useState<string | null>(null);

  // ─── Override / notes ──────────────────────────────────────────────────────
  const [notes, setNotes] = useState("");
  const [overrideAllowed, setOverrideAllowed] = useState(false);

  // ─── Session history ───────────────────────────────────────────────────────
  const [recentCheckIns, setRecentCheckIns] = useState<
    Array<{
      regNo: string;
      studentName: string;
      eventName: string;
      checkedInAt: string;
      source: string;
    }>
  >([]);

  // ─── QR Scanner (custom hook — no html5-qrcode DOM mutation) ─────────────
  const handleTokenScanned = useCallback(
    async (rawToken: string) => {
      // Scanner loop is already paused by the hook after a successful scan.
      await executeVerify({ token: rawToken });
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [selectedEventSlug]
  );

  const { videoRef, canvasRef, isScanning, error: scannerError, start: startScanner, stop: stopScanner } =
    useQrScanner({ onScan: handleTokenScanned });

  // ─── Tab switching ─────────────────────────────────────────────────────────
  async function switchTab(tab: "scanner" | "manual" | "lookup") {
    if (tab !== "scanner" && isScanning) {
      stopScanner();
    }
    setActiveTab(tab);
  }

  // ─── Verify ────────────────────────────────────────────────────────────────
  async function executeVerify(payload: {
    token?: string;
    registrationId?: string;
    regNo?: string;
  }) {
    setIsVerifying(true);
    setVerifyError(null);
    setVerificationResult(null);
    setConfirmSuccess(null);
    setConfirmError(null);
    setOverrideAllowed(false);

    try {
      const result = await verifyCheckIn({
        ...payload,
        eventSlug: selectedEventSlug || undefined,
      });
      setVerificationResult(result);
      if (result.alreadyCheckedIn) setOverrideAllowed(true);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Verification failed";
      setVerifyError(msg);
      if (err && typeof err === "object" && "data" in err) {
        setVerificationResult({
          eligible: false,
          reason: "ERROR",
          message: msg,
          data: (err as { data: CheckInVerificationResult["data"] }).data,
        });
      }
    } finally {
      setIsVerifying(false);
    }
  }

  async function handleManualSubmit(e: React.FormEvent) {
    e.preventDefault();
    const v = manualInput.trim();
    if (!v) return;
    if (v.includes(".")) {
      await executeVerify({ token: v });
    } else if (
      v.toUpperCase().startsWith("REG-") ||
      v.toUpperCase().startsWith("ZEP-") ||
      v.length >= 4
    ) {
      await executeVerify({ regNo: v.toUpperCase() });
    } else {
      await executeVerify({ registrationId: v });
    }
  }

  async function handleSearchAttendees() {
    if (!searchQuery.trim()) return;
    setIsSearching(true);
    try {
      const res = await lookupAttendees({
        search: searchQuery.trim(),
        event: selectedEventSlug || undefined,
        limit: 20,
      });
      setLookupResults(res.items || []);
    } catch (err: unknown) {
      setVerifyError(err instanceof Error ? err.message : "Failed to search attendees");
    } finally {
      setIsSearching(false);
    }
  }

  async function handleConfirmCheckIn(override = false) {
    if (!verificationResult?.data?.id) return;
    setIsConfirming(true);
    setConfirmError(null);
    setConfirmSuccess(null);

    try {
      const res = await confirmCheckIn({
        registrationId: verificationResult.data.id,
        eventSlug: selectedEventSlug || undefined,
        overrideDuplicate: override,
        source: activeTab === "scanner" ? "qr_scan" : "manual",
        notes: notes.trim() || undefined,
      });

      setConfirmSuccess(res.message);
      setVerificationResult((prev) =>
        prev
          ? {
              ...prev,
              eligible: false,
              alreadyCheckedIn: true,
              data: {
                ...prev.data,
                attendanceStatus: "present",
                checkedInAt: res.data.checkedInAt,
                checkedInBy: res.data.checkedInBy,
                checkInSource: res.data.checkInSource,
              },
            }
          : null
      );

      setRecentCheckIns((prev) => [
        {
          regNo: res.data.regNo,
          studentName: res.data.studentName,
          eventName: res.data.event?.name || "Event",
          checkedInAt: new Date().toLocaleTimeString(),
          source: res.data.checkInSource || "qr_scan",
        },
        ...prev.slice(0, 9),
      ]);
    } catch (err: unknown) {
      setConfirmError(err instanceof Error ? err.message : "Failed to confirm check-in");
    } finally {
      setIsConfirming(false);
    }
  }

  function handleReset() {
    setVerificationResult(null);
    setVerifyError(null);
    setConfirmError(null);
    setConfirmSuccess(null);
    setManualInput("");
    setNotes("");
    setOverrideAllowed(false);
    if (activeTab === "scanner") {
      startScanner();
    }
  }

  // ─── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-bold text-zinc-900 sm:text-2xl">
            Gate Check-in Console
          </h1>
          <p className="text-xs text-zinc-500">
            {clubName ? `${clubName} • ` : ""}Scan QR entry passes or manually check in attendees.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <label htmlFor="event-filter" className="text-xs font-semibold text-zinc-700 whitespace-nowrap">
            Active Event:
          </label>
          <select
            id="event-filter"
            value={selectedEventSlug}
            onChange={(e) => {
              setSelectedEventSlug(e.target.value);
              setVerificationResult(null);
            }}
            className="rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-xs font-medium text-zinc-800 shadow-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
          >
            <option value="">All Club Events (Any)</option>
            {events.map((ev) => (
              <option key={ev.slug} value={ev.slug}>
                {ev.name} {ev.approvedCount ? `(${ev.approvedCount} approved)` : ""}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Main grid */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">

        {/* ── Left column ──────────────────────────────────────────────────── */}
        <div className="space-y-4 lg:col-span-5">

          {/* Tab bar */}
          <div className="flex rounded-lg border border-zinc-200 bg-zinc-50 p-1">
            {(["scanner", "manual", "lookup"] as const).map((tab) => (
              <button
                key={tab}
                type="button"
                onClick={() => switchTab(tab)}
                className={`flex-1 rounded-md py-1.5 text-xs font-semibold transition ${
                  activeTab === tab
                    ? "bg-white text-zinc-900 shadow-sm"
                    : "text-zinc-500 hover:text-zinc-800"
                }`}
              >
                {tab === "scanner" ? "📷 QR Scanner" : tab === "manual" ? "⌨️ Manual Token / ID" : "🔍 Search Attendees"}
              </button>
            ))}
          </div>

          {/* ── TAB 1: Camera scanner ─────────────────────────────────────── */}
          {/*
           * The <video> and <canvas> are React-owned refs.
           * jsQR reads raw pixel data — it never touches the DOM.
           * There is no third-party library mutating the DOM tree, so React
           * can unmount this freely without any removeChild conflicts.
           *
           * We keep the scanner card mounted at all times (hidden when the
           * tab is inactive) so the video element is always available for the
           * MediaStream even if the user briefly switches tabs.
           */}
          <div className={`surface-card p-5 text-center space-y-4 ${activeTab !== "scanner" ? "hidden" : ""}`}>
            {/* Hidden canvas used only for pixel capture — not visible to user */}
            <canvas ref={canvasRef} className="hidden" aria-hidden="true" />

            <div className="mx-auto w-full max-w-xs overflow-hidden rounded-lg border border-zinc-200 bg-zinc-950 min-h-[250px] flex items-center justify-center">
              {/* The <video> element React fully owns — no external lib touches it */}
              <video
                ref={videoRef}
                playsInline
                muted
                className={`w-full h-full object-cover ${isScanning ? "block" : "hidden"}`}
              />
              {!isScanning && (
                <p className="p-4 text-xs text-zinc-400 font-mono">
                  Camera is stopped. Click Start Scanner below.
                </p>
              )}
            </div>

            {scannerError && (
              <div className="rounded-md bg-rose-50 p-2.5 text-xs text-rose-700">
                {scannerError}
              </div>
            )}

            <div className="flex justify-center gap-2">
              {!isScanning ? (
                <button
                  type="button"
                  onClick={startScanner}
                  className="btn-primary py-2 text-xs font-semibold"
                >
                  Start Camera Scanner
                </button>
              ) : (
                <button
                  type="button"
                  onClick={stopScanner}
                  className="btn-secondary py-2 text-xs font-semibold text-rose-600"
                >
                  Stop Scanner
                </button>
              )}
            </div>
          </div>

          {/* ── TAB 2: Manual input ───────────────────────────────────────── */}
          {activeTab === "manual" && (
            <div className="surface-card p-5 space-y-3">
              <form onSubmit={handleManualSubmit} className="space-y-3">
                <div>
                  <label className="block text-xs font-semibold text-zinc-700 mb-1">
                    Registration No / Token / ID
                  </label>
                  <input
                    type="text"
                    value={manualInput}
                    onChange={(e) => setManualInput(e.target.value)}
                    placeholder="e.g. REG-0042 or paste signed QR token"
                    className="w-full rounded-lg border border-zinc-200 bg-white p-2.5 text-xs font-mono text-zinc-900 placeholder:text-zinc-400 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                  />
                </div>
                <button
                  type="submit"
                  disabled={isVerifying || !manualInput.trim()}
                  className="btn-primary w-full py-2 text-xs font-semibold disabled:opacity-50"
                >
                  {isVerifying ? "Verifying..." : "Verify Entry Pass"}
                </button>
              </form>
            </div>
          )}

          {/* ── TAB 3: Attendee search ────────────────────────────────────── */}
          {activeTab === "lookup" && (
            <div className="surface-card p-5 space-y-3">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSearchAttendees()}
                  placeholder="Search name, email, phone, Reg No..."
                  className="flex-1 rounded-lg border border-zinc-200 bg-white p-2 text-xs text-zinc-900 placeholder:text-zinc-400 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                />
                <button
                  type="button"
                  onClick={handleSearchAttendees}
                  disabled={isSearching || !searchQuery.trim()}
                  className="btn-secondary py-2 text-xs font-semibold disabled:opacity-50"
                >
                  {isSearching ? "..." : "Search"}
                </button>
              </div>

              {lookupResults.length > 0 && (
                <div className="max-h-60 overflow-y-auto divide-y divide-zinc-100 rounded-lg border border-zinc-100 bg-zinc-50">
                  {lookupResults.map((att) => (
                    <div
                      key={att.id}
                      onClick={() => executeVerify({ registrationId: att.id })}
                      className="p-2.5 hover:bg-white cursor-pointer transition flex items-center justify-between"
                    >
                      <div className="min-w-0">
                        <p className="text-xs font-semibold text-zinc-900 truncate">{att.studentName}</p>
                        <p className="text-[11px] text-zinc-500 font-mono truncate">
                          {att.regNo} • {att.studentEmail}
                        </p>
                      </div>
                      <span className={`rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase ${
                        att.attendanceStatus === "present"
                          ? "bg-emerald-100 text-emerald-800"
                          : "bg-zinc-200 text-zinc-700"
                      }`}>
                        {att.attendanceStatus === "present" ? "Checked In" : "Unchecked"}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* ── Right column: Verification result ────────────────────────────── */}
        <div className="space-y-4 lg:col-span-7">

          {verifyError && !verificationResult && (
            <div className="surface-card border-rose-200 bg-rose-50/70 p-5 space-y-2 text-rose-800">
              <div className="flex items-center gap-2 font-bold text-sm text-rose-900">
                ❌ Verification Error
              </div>
              <p className="text-xs">{verifyError}</p>
              <button type="button" onClick={handleReset} className="btn-secondary py-1 px-3 text-xs">
                Scan Again
              </button>
            </div>
          )}

          {isVerifying && (
            <div className="surface-card p-8 text-center space-y-3 animate-pulse">
              <div className="mx-auto h-8 w-8 rounded-full border-2 border-brand-600 border-t-transparent animate-spin" />
              <p className="text-xs font-semibold text-zinc-700">Verifying entry pass token...</p>
            </div>
          )}

          {verificationResult && (
            <div className={`surface-card p-6 space-y-4 border-2 transition ${
              confirmSuccess || verificationResult.eligible
                ? "border-emerald-500 bg-emerald-50/30"
                : verificationResult.alreadyCheckedIn
                ? "border-amber-400 bg-amber-50/40"
                : "border-rose-400 bg-rose-50/40"
            }`}>
              {/* Status header */}
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-zinc-200/60 pb-3">
                <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-bold uppercase tracking-wider ${
                  verificationResult.eligible
                    ? "bg-emerald-100 text-emerald-800"
                    : verificationResult.alreadyCheckedIn
                    ? "bg-amber-100 text-amber-900"
                    : "bg-rose-100 text-rose-800"
                }`}>
                  {verificationResult.eligible
                    ? "Ready for Check-in"
                    : verificationResult.alreadyCheckedIn
                    ? "Already Checked In"
                    : "Denied / Ineligible"}
                </span>
                <span className="font-mono text-xs font-bold text-zinc-700">
                  {verificationResult.data.regNo}
                </span>
              </div>

              {/* Participant details */}
              <div className="rounded-lg border border-zinc-200 bg-white p-4 space-y-2.5 text-xs">
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  <div>
                    <span className="text-zinc-400 uppercase text-[10px] font-mono">Attendee Name</span>
                    <p className="font-bold text-zinc-900 text-sm">{verificationResult.data.studentName}</p>
                  </div>
                  <div>
                    <span className="text-zinc-400 uppercase text-[10px] font-mono">Event</span>
                    <p className="font-semibold text-zinc-800">{verificationResult.data.event?.name}</p>
                  </div>
                  <div>
                    <span className="text-zinc-400 uppercase text-[10px] font-mono">Contact</span>
                    <p className="text-zinc-700 truncate">{verificationResult.data.studentEmail}</p>
                    {verificationResult.data.studentPhone && (
                      <p className="text-zinc-500 font-mono">{verificationResult.data.studentPhone}</p>
                    )}
                  </div>
                  <div>
                    <span className="text-zinc-400 uppercase text-[10px] font-mono">College / Org</span>
                    <p className="text-zinc-700">{verificationResult.data.college || "—"}</p>
                  </div>
                </div>

                {verificationResult.data.checkedInAt && (
                  <div className="mt-2 rounded bg-amber-50 p-2 text-[11px] text-amber-900 space-y-0.5">
                    <p className="font-semibold">
                      Checked in at: {new Date(verificationResult.data.checkedInAt).toLocaleString()}
                    </p>
                    {verificationResult.data.checkedInBy && (
                      <p className="text-amber-700">Staff: {verificationResult.data.checkedInBy}</p>
                    )}
                  </div>
                )}
              </div>

              {confirmSuccess && (
                <div className="rounded-md bg-emerald-100 p-3 text-xs font-semibold text-emerald-900">
                  🎉 {confirmSuccess}
                </div>
              )}
              {confirmError && (
                <div className="rounded-md bg-rose-100 p-3 text-xs font-semibold text-rose-900">
                  ⚠️ {confirmError}
                </div>
              )}

              {/* Actions */}
              <div className="space-y-2 pt-2">
                {verificationResult.eligible && (
                  <button
                    type="button"
                    onClick={() => handleConfirmCheckIn(false)}
                    disabled={isConfirming}
                    className="btn-primary w-full py-2.5 text-xs font-bold uppercase tracking-wider bg-emerald-600 hover:bg-emerald-700"
                  >
                    {isConfirming ? "Processing Check-in..." : "✓ Confirm Check-in"}
                  </button>
                )}

                {overrideAllowed && (
                  <div className="space-y-2 pt-1 border-t border-amber-200">
                    <input
                      type="text"
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      placeholder="Optional override note (e.g. re-entry after lunch)"
                      className="w-full rounded border border-amber-300 bg-white p-2 text-xs text-zinc-900 placeholder:text-zinc-400"
                    />
                    <button
                      type="button"
                      onClick={() => handleConfirmCheckIn(true)}
                      disabled={isConfirming}
                      className="btn-secondary w-full py-2 text-xs font-semibold text-amber-900 border-amber-300 hover:bg-amber-100"
                    >
                      {isConfirming ? "Overriding..." : "⚠️ Override & Check In Again"}
                    </button>
                  </div>
                )}

                <button
                  type="button"
                  onClick={handleReset}
                  className="btn-secondary w-full py-2 text-xs font-medium"
                >
                  Scan Next Participant
                </button>
              </div>
            </div>
          )}

          {/* Live session feed */}
          {recentCheckIns.length > 0 && (
            <div className="surface-card p-4 space-y-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-500">
                Recent Check-ins (This Session)
              </h3>
              <div className="divide-y divide-zinc-100 text-xs">
                {recentCheckIns.map((item, idx) => (
                  <div key={idx} className="flex items-center justify-between py-2">
                    <div>
                      <span className="font-semibold text-zinc-900">{item.studentName}</span>
                      <span className="ml-2 font-mono text-[11px] text-zinc-500">{item.regNo}</span>
                    </div>
                    <span className="font-mono text-[11px] text-zinc-400">{item.checkedInAt}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default CheckInConsole;