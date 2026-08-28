import type { RegistrationStatus } from "@/lib/api/types";

export type { RegistrationStatus };

export type PRMemberReferralItem = {
  id: string;
  regNo?: string;
  studentName: string;
  studentEmail: string;
  event?: { name: string };
  amount?: number;
  status: "approved" | "rejected" | "pending";
  rejectionReason?: string;
  createdAt: string;
};
