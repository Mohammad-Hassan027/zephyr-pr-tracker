/**
 * Shared Common & Pagination Types
 */
export type PaginatedResponse<T> = {
  items: T[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPrevPage: boolean;
  };
};

/**
 * Event Domain Types
 */
export type EventItem = {
  _id: string;
  name: string;
  slug: string;
  description?: string;
  venue?: string;
  fee?: number;
  date?: string;
  capacity: number | null;
};

/**
 * Registration Domain Types
 */
export type RegistrationStatus = {
  id?: string;
  status: "pending" | "approved" | "rejected";
  rejectionReason: string | null;
  regNo: string | null;
  studentName: string;
  studentEmail: string;
  studentPhone?: string;
  college?: string;
  amount?: number;
  createdAt: string;
  event: {
    name: string;
    slug: string;
    date?: string;
    venue?: string;
    fee?: number;
    description?: string;
  };
  club?: {
    name: string;
    slug: string;
    email: string;
  };
};

export type UploadSignature = {
  timestamp: number;
  signature: string;
  api_key: string;
  cloud_name: string;
  folder: string;
};

export type CloudinaryUploadResponse = {
  secure_url?: string;
  public_id?: string;
  error?: { message?: string };
};

export type SubmitRegistrationForm = {
  studentName: string;
  studentEmail: string;
  studentPhone: string;
  college: string;
  amount: string;
  utr?: string;
  eventSlug: string;
  clubSlug?: string;
  referralCode: string;
  paymentScreenshot: string;
  paymentScreenshotPublicId: string;
};

export type CheckDuplicateParams = {
  clubSlug: string;
  eventSlug: string;
  studentEmail: string;
};

export type LookupParams = {
  studentEmail: string;
  clubSlug?: string;
};

export type LookupResult = {
  id: string;
  regNo: string | null;
  status: "pending" | "approved" | "rejected";
  studentName: string;
  studentEmail: string;
  studentPhone?: string;
  college?: string;
  amount?: number;
  createdAt: string;
  rejectionReason?: string;
  event: {
    name: string;
    slug: string;
    date?: string;
    venue?: string;
    fee?: number;
    description?: string;
  };
  club: {
    name: string;
    slug: string;
    email: string;
  };
};

/**
 * Review Queue Domain Types
 */
export type PendingRegistration = {
  _id: string;
  studentName: string;
  studentEmail: string;
  studentPhone?: string;
  college?: string;
  amount?: number;
  utr?: string;
  referralCode: string | null;
  paymentScreenshot: string;
  createdAt: string;
  event: {
    name: string;
    slug: string;
    venue?: string;
    fee?: number;
    date?: string;
    description?: string;
  };
};

export type PendingQueueFilters = {
  event?: string;
  college?: string;
  from?: string;
  to?: string;
  page?: number;
  limit?: number;
};

export type BulkReviewResponse = {
  ok: boolean;
  processed: number;
  failed: number;
  errors?: any[];
};

/**
 * Statistics & Leaderboard Domain Types
 */
export type EventStat = {
  eventId: string;
  name: string;
  slug: string;
  capacity: number | null;
  count: number;
};

export type LeaderboardEntry = {
  name: string;
  code: string;
  count: number;
};

/**
 * PR Member Domain Types
 */
export type PRMemberReferral = {
  id: string;
  regNo: string | null;
  studentName: string;
  studentEmail: string;
  studentPhone?: string;
  college?: string;
  amount?: number;
  utr?: string;
  status: "pending" | "approved" | "rejected";
  rejectionReason?: string;
  event?: { name: string; slug: string; fee?: number };
  createdAt: string;
};

export type PRMemberStats = {
  code: string;
  totalApproved: number;
  totalPending: number;
  totalRejected: number;
  totalRevenue: number;
  referrals: PRMemberReferral[];
};

/**
 * Club Domain Types
 */
export type PublicClub = {
  name: string;
  slug: string;
};
