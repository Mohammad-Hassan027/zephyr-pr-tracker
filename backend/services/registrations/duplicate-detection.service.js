import registrationRepository from "../../repositories/registration.repository.js";

/**
 * Normalizes an email address for comparison:
 * - Trims whitespace
 * - Converts to lowercase
 */
export function normalizeEmail(email) {
  if (!email || typeof email !== "string") return "";
  return email.trim().toLowerCase();
}

/**
 * Normalizes a phone number:
 * - Strips all non-digit characters
 * - Normalizes 10-digit Indian numbers (strips leading 0 or +91/91 prefix)
 */
export function normalizePhone(phone) {
  if (!phone || typeof phone !== "string") return "";
  let digits = phone.replace(/\D/g, "");
  // If 11 digits and starts with 0 (e.g. 09876543210 -> 9876543210)
  if (digits.length === 11 && digits.startsWith("0")) {
    digits = digits.slice(1);
  }
  // If 12 digits and starts with 91 (e.g. 919876543210 -> 9876543210)
  else if (digits.length === 12 && digits.startsWith("91")) {
    digits = digits.slice(2);
  }
  return digits;
}

/**
 * Normalizes a transaction ID / UTR reference:
 * - Trims whitespace
 * - Strips non-alphanumeric punctuation/spaces
 * - Converts to uppercase
 */
export function normalizeUtr(utr) {
  if (!utr || typeof utr !== "string") return "";
  return utr.replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
}

/**
 * Normalizes a participant name:
 * - Lowercases, trims
 * - Collapses consecutive spaces
 * - Strips punctuation
 */
export function normalizeName(name) {
  if (!name || typeof name !== "string") return "";
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Computes Levenshtein distance between two strings.
 */
function levenshteinDistance(a, b) {
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;

  const matrix = [];
  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, // substitution
          matrix[i][j - 1] + 1,     // insertion
          matrix[i - 1][j] + 1      // deletion
        );
      }
    }
  }

  return matrix[b.length][a.length];
}

/**
 * Calculates similarity ratio between two names (0.0 to 1.0).
 */
export function calculateNameSimilarity(name1, name2) {
  const n1 = normalizeName(name1);
  const n2 = normalizeName(name2);
  if (!n1 || !n2) return 0;
  if (n1 === n2) return 1.0;

  const maxLen = Math.max(n1.length, n2.length);
  if (maxLen === 0) return 1.0;

  const dist = levenshteinDistance(n1, n2);
  return Math.max(0, 1 - dist / maxLen);
}

export const duplicateDetectionService = {
  normalizeEmail,
  normalizePhone,
  normalizeUtr,
  normalizeName,
  calculateNameSimilarity,

  /**
   * Evaluates a pending registration against existing records across multiple detection signals.
   * Does NOT reject the registration — returns detection signals with matching details and confidence.
   *
   * @param {Object} input - Incoming registration data
   * @param {Object} context - { eventId, clubId, session, excludeRegistrationId }
   * @returns {Promise<{ isSuspicious: boolean, signals: Array }>}
   */
  async detectSuspiciousSignals(input, { eventId, clubId, session = null, excludeRegistrationId = null } = {}) {
    const normEmail = normalizeEmail(input.studentEmail);
    const normPhone = normalizePhone(input.studentPhone);
    const normUtr = normalizeUtr(input.utr);
    const publicId = (input.paymentScreenshotPublicId || "").trim();
    const studentName = input.studentName || "";

    const signals = [];

    // Query candidates matching any normalized identifier
    const existingCandidates = await registrationRepository.findMatchesForDuplicateDetection({
      eventId,
      clubId,
      normalizedEmail: normEmail,
      normalizedPhone: normPhone,
      normalizedUtr: normUtr,
      paymentScreenshotPublicId: publicId,
      excludeRegistrationId,
      session,
    });

    for (const candidate of existingCandidates) {
      const isSameEvent = candidate.event && candidate.event.toString() === eventId.toString();

      // Signal 1: Same email for the same event
      if (isSameEvent && normEmail && candidate.normalizedEmail === normEmail) {
        signals.push({
          signal: "SAME_EMAIL_SAME_EVENT",
          reason: `Duplicate email (${input.studentEmail}) found on registration ${candidate.regNo || candidate._id} for this event`,
          matchingRegistrationId: candidate._id,
          matchingField: "studentEmail",
          detectedAt: new Date(),
          confidence: "high",
        });
      }

      // Signal 2: Same phone number for the same event
      if (isSameEvent && normPhone && normPhone.length >= 7 && candidate.normalizedPhone === normPhone) {
        signals.push({
          signal: "SAME_PHONE_SAME_EVENT",
          reason: `Duplicate phone number (${input.studentPhone}) found on registration ${candidate.regNo || candidate._id} for this event`,
          matchingRegistrationId: candidate._id,
          matchingField: "studentPhone",
          detectedAt: new Date(),
          confidence: "high",
        });
      }

      // Signal 3: Reused transaction ID / UTR
      if (normUtr && normUtr.length >= 4 && candidate.normalizedUtr === normUtr) {
        const approvedNotice = candidate.status === "approved" ? " [ALREADY APPROVED]" : "";
        signals.push({
          signal: "REUSED_TRANSACTION_ID",
          reason: `Payment transaction ID/UTR (${input.utr}) is already linked to registration ${candidate.regNo || candidate._id}${approvedNotice}`,
          matchingRegistrationId: candidate._id,
          matchingField: "utr",
          detectedAt: new Date(),
          confidence: "high",
        });
      }

      // Signal 4: Reused payment proof asset fingerprint
      if (publicId && candidate.paymentScreenshotPublicId && candidate.paymentScreenshotPublicId === publicId) {
        signals.push({
          signal: "REUSED_PAYMENT_PROOF",
          reason: `Identical payment screenshot asset uploaded for registration ${candidate.regNo || candidate._id}`,
          matchingRegistrationId: candidate._id,
          matchingField: "paymentScreenshotPublicId",
          detectedAt: new Date(),
          confidence: "high",
        });
      }

      // Signal 5: Similar name with matching college / contact details
      if (isSameEvent && studentName && candidate.studentName) {
        const sim = calculateNameSimilarity(studentName, candidate.studentName);
        if (sim >= 0.85 && sim < 1.0) {
          const matchingCollege = input.college && candidate.college && input.college.toLowerCase().trim() === candidate.college.toLowerCase().trim();
          if (matchingCollege || candidate.normalizedPhone === normPhone) {
            signals.push({
              signal: "SIMILAR_NAME_MATCHING_CONTACT",
              reason: `Very similar name ('${studentName}' vs '${candidate.studentName}' ${(sim * 100).toFixed(0)}% match) on registration ${candidate.regNo || candidate._id}`,
              matchingRegistrationId: candidate._id,
              matchingField: "studentName",
              detectedAt: new Date(),
              confidence: "medium",
            });
          }
        }
      }

      // Signal 6: Repeated registrations within short window (< 5 minutes)
      if (candidate.createdAt) {
        const diffMs = Math.abs(Date.now() - new Date(candidate.createdAt).getTime());
        if (diffMs < 5 * 60 * 1000 && (candidate.normalizedEmail === normEmail || candidate.normalizedPhone === normPhone)) {
          signals.push({
            signal: "HIGH_FREQUENCY_SUBMISSION",
            reason: `Repeated registration submitted within ${(diffMs / 1000).toFixed(0)}s of registration ${candidate.regNo || candidate._id}`,
            matchingRegistrationId: candidate._id,
            matchingField: "createdAt",
            detectedAt: new Date(),
            confidence: "medium",
          });
        }
      }
    }

    return {
      isSuspicious: signals.length > 0,
      signals,
    };
  },
};

export default duplicateDetectionService;
