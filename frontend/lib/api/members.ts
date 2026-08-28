import { apiFetch } from "./client";
import type { PRMemberReferral, PRMemberStats } from "./types";

export type { PRMemberReferral, PRMemberStats };

export async function getPRMemberStats(): Promise<PRMemberStats> {
  return apiFetch<PRMemberStats>("/api/pr/stats", { cache: "no-store" });
}

export async function changePRPin(
  newPin: string,
  oldPin?: string
): Promise<{ ok: boolean; message: string }> {
  return apiFetch<{ ok: boolean; message: string }>("/api/pr/change-pin", {
    method: "POST",
    body: { newPin, oldPin },
  });
}
