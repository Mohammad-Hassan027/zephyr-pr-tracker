import "dotenv/config";
import assert from "node:assert/strict";
import {
  canReviewRegistration,
  getReviewerCode,
} from "../policies/registration.policy.js";
import {
  toTrimmedString,
  isValidCloudinaryPublicId,
  isValidCloudinaryImageUrl,
  parsePagination,
  buildDateFilter,
} from "../validators/registration.validators.js";
import { isTransientError, withTransaction } from "../utils/transaction.js";
import { AppError, ConflictError, ForbiddenError } from "../utils/errors.js";

async function runDomainUnitTests() {
  console.log("=== RUNNING REGISTRATION DOMAIN UNIT TESTS ===");

  // 1. Policy Authorization Tests
  console.log("\n[Test 1] Policy Authorization Rules:");
  const clubAuth = { role: "club", clubId: "club123" };
  const prAuth = { role: "pr", code: "RAHUL123", clubId: "club123" };
  const wrongClubAuth = { role: "club", clubId: "other_club" };

  const regMatch = {
    club: "club123",
    referralCode: "RAHUL123",
    status: "pending",
  };
  const regOtherCode = {
    club: "club123",
    referralCode: "SNEHA999",
    status: "pending",
  };

  assert.equal(getReviewerCode(clubAuth), "admin");
  assert.equal(getReviewerCode(prAuth), "RAHUL123");

  assert.equal(canReviewRegistration(clubAuth, regMatch), true);
  assert.equal(canReviewRegistration(prAuth, regMatch), true);
  assert.equal(canReviewRegistration(prAuth, regOtherCode), false);
  assert.equal(canReviewRegistration(wrongClubAuth, regMatch), false);
  console.log("✔ Policy authorization tests passed!");

  // 2. Validator Unit Tests
  console.log("\n[Test 2] Validator Functions:");
  assert.equal(toTrimmedString("  hello  "), "hello");
  assert.equal(toTrimmedString(null), "");

  const validPublicId = "zephyr-payments/abc_123_test";
  const invalidPublicId = "wrong-folder/abc_123";
  const traversalPublicId = "zephyr-payments/../secret";

  assert.equal(isValidCloudinaryPublicId(validPublicId), true);
  assert.equal(isValidCloudinaryPublicId(invalidPublicId), false);
  assert.equal(isValidCloudinaryPublicId(traversalPublicId), false);

  const validUrl = `https://res.cloudinary.com/demo/image/upload/v12345/${validPublicId}.jpg`;
  const invalidUrl = `https://malicious.com/upload/${validPublicId}.jpg`;

  assert.equal(isValidCloudinaryImageUrl(validUrl, validPublicId), true);
  assert.equal(isValidCloudinaryImageUrl(invalidUrl, validPublicId), false);

  const pag = parsePagination({ page: "2", limit: "50" });
  assert.equal(pag.page, 2);
  assert.equal(pag.limit, 50);
  assert.equal(pag.skip, 50);

  const dateF = buildDateFilter("2026-01-01", "2026-01-31");
  assert.ok(dateF.$gte instanceof Date);
  assert.ok(dateF.$lte instanceof Date);
  console.log("✔ Validator tests passed!");

  // 3. Transaction Retry & Failure Behavior Tests
  console.log("\n[Test 3] Transaction Retry & Failure Simulation:");
  const transientErr = new Error("Write conflict");
  transientErr.code = 112;
  assert.equal(isTransientError(transientErr), true);

  const nonTransientErr = new ConflictError("Already reviewed");
  assert.equal(isTransientError(nonTransientErr), false);

  let attempts = 0;
  const mockSession = {
    startTransaction: () => {},
    commitTransaction: async () => {},
    abortTransaction: async () => {},
    endSession: async () => {},
    inTransaction: () => true,
  };
  const mockConnection = {
    startSession: async () => ({ ...mockSession }),
  };

  const retryResult = await withTransaction(
    async (session) => {
      attempts++;
      if (attempts < 2) {
        throw transientErr;
      }
      return { success: true, attempts };
    },
    {
      maxRetries: 3,
      initialDelayMs: 10,
      connection: mockConnection,
      logger: { warn: () => {}, debug: () => {} },
    },
  );

  assert.equal(retryResult.success, true);
  assert.equal(attempts, 2);

  let aborted = false;
  try {
    await withTransaction(
      async () => {
        throw nonTransientErr;
      },
      {
        maxRetries: 3,
        connection: mockConnection,
        logger: { warn: () => {}, debug: () => {} },
      },
    );
  } catch (err) {
    aborted = err instanceof ConflictError;
  }
  assert.equal(aborted, true);
  console.log("✔ Transaction retry & failure behavior tests passed!");

  console.log("\n=== ALL REGISTRATION DOMAIN UNIT TESTS PASSED ===");
}

runDomainUnitTests()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Domain Unit Test Failed:", err);
    process.exit(1);
  });
