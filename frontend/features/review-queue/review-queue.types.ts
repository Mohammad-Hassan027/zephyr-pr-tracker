import type { EventItem, PendingRegistration, PendingQueueFilters } from "@/lib/api/types";

export type { EventItem, PendingRegistration, PendingQueueFilters };

export type ReviewDialogMode = "reject" | "correction";

export type ReviewModalState = {
  isOpen: boolean;
  mode: ReviewDialogMode;
  isBulk: boolean;
  targetId: string | null;
};

export type RejectModalState = {
  isOpen: boolean;
  isBulk: boolean;
  targetId: string | null;
};
