import type { EventItem, PendingRegistration, PendingQueueFilters } from "@/lib/api/types";

export type { EventItem, PendingRegistration, PendingQueueFilters };

export type RejectModalState = {
  isOpen: boolean;
  isBulk: boolean;
  targetId: string | null;
};
