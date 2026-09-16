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
  approvedCount?: number;
  status?: "draft" | "open" | "closed" | "completed";
};

export type EventCapacityInfo = {
  capacity: number | null;
  approvedCount: number;
  remaining: number | null;
  isFull: boolean;
};

export type HistoryItem = {
  action: string;
  status: string;
  performedBy?: string | null;
  note?: string | null;
  changes?: Record<string, any> | null;
  timestamp: string;
};

export type WorkflowStatus =
  | "pending"
  | "approved"
  | "rejected"
  | "needs_correction"
  | "resubmitted"
  | "under_review";

/**
 * Registration Domain Types
 */
export type RegistrationStatus = {
  id?: string;
  status: WorkflowStatus;
  rejectionReason: string | null;
  correctionNote?: string | null;
  lastCorrectionRequestedAt?: string | null;
  resubmittedAt?: string | null;
  history?: HistoryItem[];
  regNo: string | null;
  studentName: string;
  studentEmail: string;
  studentPhone?: string;
  college?: string;
  amount?: number;
  utr?: string;
  paymentScreenshot?: string;
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
  upload_preset: string;
  resource_type: "image";
  allowed_formats: string[];
  max_file_size: number;
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

export type ResubmitRegistrationForm = {
  studentName?: string;
  studentPhone?: string;
  college?: string;
  amount?: number;
  utr?: string;
  paymentScreenshot?: string;
  paymentScreenshotPublicId?: string;
};

export type SubmitRegistrationResponse = {
  id: string;
  status: string;
  accessToken: string;
};

export type CheckDuplicateParams = {
  clubSlug: string;
  eventSlug: string;
  studentEmail: string;
};

export type CheckDuplicateResult = {
  exists: boolean;
  status?: string;
  regNo?: string | null;
};

export type LookupParams = {
  studentEmail: string;
  clubSlug?: string;
  accessToken?: string;
};

export type LookupResult = {
  id: string;
  regNo: string | null;
  status: WorkflowStatus;
  studentName: string;
  studentEmail: string;
  studentPhone?: string;
  college?: string;
  amount?: number;
  createdAt: string;
  rejectionReason?: string;
  correctionNote?: string;
  lastCorrectionRequestedAt?: string;
  resubmittedAt?: string;
  history?: HistoryItem[];
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
 * Duplicate and Suspicious Registration Types
 */
export type SuspicionSignalType =
  | "SAME_EMAIL_SAME_EVENT"
  | "SAME_PHONE_SAME_EVENT"
  | "REUSED_TRANSACTION_ID"
  | "REUSED_PAYMENT_PROOF"
  | "SIMILAR_NAME_MATCHING_CONTACT"
  | "HIGH_FREQUENCY_SUBMISSION"
  | "OTHER";

export type SuspicionSignal = {
  signal: SuspicionSignalType;
  reason: string;
  matchingRegistrationId?: string | null;
  matchingField?: string | null;
  detectedAt: string;
  confidence: "low" | "medium" | "high";
};

export type SuspicionResolution = {
  status: "pending" | "confirmed_duplicate" | "marked_legitimate" | "linked" | "ignored";
  resolvedBy?: string | null;
  resolvedAt?: string | null;
  notes?: string | null;
  linkedRegistrationId?: string | null;
};

export type SuspicionFlags = {
  isSuspicious: boolean;
  signals: SuspicionSignal[];
  resolution: SuspicionResolution;
};

export type ResolveDuplicateParams = {
  action: "confirm_duplicate" | "mark_legitimate" | "link" | "ignore";
  notes?: string;
  linkedRegistrationId?: string;
};

export type ResolveDuplicateResponse = {
  ok: boolean;
  message: string;
  data: {
    id: string;
    status: WorkflowStatus;
    suspicionFlags: SuspicionFlags;
    history: HistoryItem[];
  };
};

/**
 * Review Queue Domain Types
 */
export type PendingRegistration = {
  _id: string;
  status?: WorkflowStatus;
  studentName: string;
  studentEmail: string;
  studentPhone?: string;
  college?: string;
  amount?: number;
  utr?: string;
  referralCode: string | null;
  paymentScreenshot: string;
  correctionNote?: string | null;
  lastCorrectionRequestedAt?: string | null;
  resubmittedAt?: string | null;
  suspicionFlags?: SuspicionFlags;
  history?: HistoryItem[];
  createdAt: string;
  event: {
    name: string;
    slug: string;
    venue?: string;
    fee?: number;
    date?: string;
    description?: string;
    capacity?: number | null;
    approvedCount?: number;
  };
};

export type PendingQueueFilters = {
  event?: string;
  college?: string;
  status?: string;
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
  checkedInCount?: number;
  attendanceRate?: number;
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
  status: WorkflowStatus;
  rejectionReason?: string;
  correctionNote?: string;
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

/**
 * Entry Pass & Check-In Domain Types
 */
export type AttendanceStatus = "present" | "absent" | "not_marked";

export type EntryPassData = {
  ok: boolean;
  token: string;
  qrCodeDataUrl: string;
  pass: {
    id: string;
    regNo: string;
    studentName: string;
    studentEmail: string;
    college?: string;
    amount?: number;
    status: WorkflowStatus;
    attendanceStatus: AttendanceStatus;
    checkedInAt?: string | null;
    checkedInBy?: string | null;
    event: {
      id: string;
      name: string;
      slug: string;
      date?: string | null;
      venue?: string;
    };
    club: {
      id: string;
      name: string;
      slug: string;
    };
  };
};

export type CheckInVerificationResult = {
  eligible: boolean;
  alreadyCheckedIn?: boolean;
  reason?: string;
  message: string;
  data: {
    id: string;
    regNo: string;
    studentName: string;
    studentEmail: string;
    studentPhone?: string;
    college?: string;
    amount?: number;
    status: WorkflowStatus;
    attendanceStatus: AttendanceStatus;
    checkedInAt?: string | null;
    checkedInBy?: string | null;
    checkInSource?: string | null;
    event: {
      id: string;
      name: string;
      slug: string;
      date?: string | null;
      venue?: string;
    };
    club: {
      id: string;
      name: string;
      slug: string;
    };
  };
};

export type CheckInConfirmationResult = {
  ok: boolean;
  message: string;
  data: CheckInVerificationResult["data"];
};

export type AttendeeLookupItem = {
  id: string;
  regNo: string;
  studentName: string;
  studentEmail: string;
  studentPhone?: string;
  college?: string;
  amount?: number;
  status: WorkflowStatus;
  attendanceStatus: AttendanceStatus;
  checkedInAt?: string | null;
  checkedInBy?: string | null;
  event: {
    _id?: string;
    name?: string;
    slug?: string;
    venue?: string;
  };
  club?: {
    _id?: string;
    name?: string;
    slug?: string;
  };
};
