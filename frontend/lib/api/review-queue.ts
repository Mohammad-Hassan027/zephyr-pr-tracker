import { apiFetch } from "./client";
import type {
  BulkReviewResponse,
  PaginatedResponse,
  PendingQueueFilters,
  PendingRegistration,
} from "./types";

export type {
  BulkReviewResponse,
  PaginatedResponse,
  PendingQueueFilters,
  PendingRegistration,
};

export async function getPendingQueue(
  code?: string,
  filters?: PendingQueueFilters,
  signal?: AbortSignal
): Promise<PaginatedResponse<PendingRegistration>> {
  const baseUrl = code
    ? "/api/pr/registrations/pending"
    : "/api/admin/registrations/pending";

  const params: Record<string, string | number | undefined> = {};
  if (code) params.code = code;
  if (filters?.event) params.event = filters.event;
  if (filters?.college) params.college = filters.college;
  if (filters?.from) params.from = filters.from;
  if (filters?.to) params.to = filters.to;
  if (filters?.page) params.page = filters.page;
  if (filters?.limit) params.limit = filters.limit;

  return apiFetch<PaginatedResponse<PendingRegistration>>(baseUrl, {
    cache: "no-store",
    signal,
    params,
  });
}

export async function approveRegistration(
  id: string,
  reviewerCode?: string
): Promise<any> {
  const url = reviewerCode
    ? `/api/pr/registrations/${id}/approve`
    : `/api/admin/registrations/${id}/approve`;
  return apiFetch<any>(url, { method: "PATCH" });
}

export async function rejectRegistration(
  id: string,
  reviewerCode?: string,
  reason?: string
): Promise<any> {
  const url = reviewerCode
    ? `/api/pr/registrations/${id}/reject`
    : `/api/admin/registrations/${id}/reject`;
  return apiFetch<any>(url, {
    method: "PATCH",
    body: { reason },
  });
}

export async function bulkApproveRegistrations(
  ids: string[],
  reviewerCode?: string
): Promise<BulkReviewResponse> {
  const url = reviewerCode
    ? "/api/pr/registrations/bulk-approve"
    : "/api/admin/registrations/bulk-approve";
  return apiFetch<BulkReviewResponse>(url, {
    method: "POST",
    body: { ids },
  });
}

export async function bulkRejectRegistrations(
  ids: string[],
  reason?: string,
  reviewerCode?: string
): Promise<BulkReviewResponse> {
  const url = reviewerCode
    ? "/api/pr/registrations/bulk-reject"
    : "/api/admin/registrations/bulk-reject";
  return apiFetch<BulkReviewResponse>(url, {
    method: "POST",
    body: { ids, reason },
  });
}
