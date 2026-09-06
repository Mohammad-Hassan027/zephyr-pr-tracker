export type ExportType =
  | "all"
  | "approved"
  | "pending"
  | "rejected"
  | "needs_correction"
  | "attendance"
  | "referral_performance"
  | "payment_reconciliation";

export type ExportParams = {
  type?: ExportType;
  event?: string;
  status?: string;
  from?: string;
  to?: string;
  code?: string;
  attendanceStatus?: string;
  college?: string;
  dateField?: "createdAt" | "reviewedAt" | "updatedAt";
};

/**
 * Initiates streaming CSV export download and saves file to user's device.
 */
export async function downloadExport(
  params: ExportParams = {},
  portal: "admin" | "pr" = "admin",
): Promise<{ filename: string }> {
  const query = new URLSearchParams();
  if (params.type) query.set("type", params.type);
  if (params.event) query.set("event", params.event);
  if (params.status && params.status !== "all") query.set("status", params.status);
  if (params.from) query.set("from", params.from);
  if (params.to) query.set("to", params.to);
  if (params.code) query.set("code", params.code);
  if (params.attendanceStatus && params.attendanceStatus !== "all") {
    query.set("attendanceStatus", params.attendanceStatus);
  }
  if (params.college) query.set("college", params.college);
  if (params.dateField) query.set("dateField", params.dateField);

  const endpoint =
    portal === "pr"
      ? `/api/pr/registrations/export?${query.toString()}`
      : `/api/admin/registrations/export?${query.toString()}`;

  const res = await fetch(endpoint, {
    method: "GET",
    headers: { Accept: "text/csv" },
    cache: "no-store",
  });

  if (!res.ok) {
    let errorMsg = "Export request failed";
    try {
      const errJson = await res.json();
      if (errJson.error) errorMsg = errJson.error;
    } catch {
      // fallback
    }
    throw new Error(errorMsg);
  }

  // Parse filename from Content-Disposition header if available
  let filename = `zephyr-export-${params.type || "all"}-${new Date().toISOString().split("T")[0]}.csv`;
  const disposition = res.headers.get("content-disposition");
  if (disposition && disposition.includes("filename=")) {
    const match = disposition.match(/filename="?([^";]+)"?/);
    if (match?.[1]) {
      filename = match[1];
    }
  }

  const blob = await res.blob();
  const blobUrl = window.URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = blobUrl;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.URL.revokeObjectURL(blobUrl);

  return { filename };
}
