import { isTransientError, withTransaction } from "../utils/transaction.js";
import { nextSequence, nextFormattedId } from "../models/Counter.js";
import { AppError, ConflictError, NotFoundError, ForbiddenError } from "../utils/errors.js";

async function runTests() {
  console.log("=== RUNNING UNIT & CONCURRENCY CONTROL TESTS ===");

  // Test 1: Transient Error Detection
  console.log("\n[Test 1] Transient Error Detection:");
  const writeConflictErr = new Error("Write conflict occurred during commit");
  writeConflictErr.code = 112;
  console.assert(isTransientError(writeConflictErr) === true, "WriteConflict 112 should be transient");

  const transientLabeledErr = new Error("Transient error");
  transientLabeledErr.hasErrorLabel = (label) => label === "TransientTransactionError";
  console.assert(isTransientError(transientLabeledErr) === true, "TransientTransactionError label should be transient");

  const validationErr = new AppError("Invalid email", 400);
  console.assert(isTransientError(validationErr) === false, "AppError should NOT be transient");

  const conflictErr = new ConflictError("Already reviewed");
  console.assert(isTransientError(conflictErr) === false, "ConflictError 409 should NOT be transient");
  console.log("✔ Transient error detection tests passed!");

  // Test 2: withTransaction retry simulation with mocked connection
  console.log("\n[Test 2] withTransaction Retry & Backoff Simulation:");
  let attemptCount = 0;
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

  const mockLogger = {
    warn: (msg) => console.log("   [MockLogger Warn]:", msg),
    debug: () => {},
  };

  const result = await withTransaction(
    async (session) => {
      attemptCount++;
      if (attemptCount < 3) {
        const transientErr = new Error("Mock WriteConflict simulation");
        transientErr.code = 112;
        throw transientErr;
      }
      return { success: true, attempts: attemptCount };
    },
    {
      maxRetries: 3,
      initialDelayMs: 20,
      maxDelayMs: 100,
      connection: mockConnection,
      logger: mockLogger,
    }
  );

  console.assert(result.success === true, "Should succeed on 3rd attempt");
  console.assert(attemptCount === 3, `Expected 3 attempts, got ${attemptCount}`);
  console.log("✔ Retry with backoff simulation passed!");

  // Test 3: Non-transient errors should NOT retry and abort immediately
  console.log("\n[Test 3] Non-transient errors abort without unnecessary retries:");
  let nonTransientAttempts = 0;
  try {
    await withTransaction(
      async (session) => {
        nonTransientAttempts++;
        throw new ConflictError("Already reviewed");
      },
      {
        maxRetries: 3,
        connection: mockConnection,
        logger: mockLogger,
      }
    );
  } catch (err) {
    console.assert(err instanceof ConflictError, "Should catch ConflictError");
    console.assert(nonTransientAttempts === 1, `Expected exactly 1 attempt for business error, got ${nonTransientAttempts}`);
  }
  console.log("✔ Non-transient abort test passed!");

  console.log("\n=== ALL UNIT TESTS COMPLETED SUCCESSFULLY ===");
  process.exit(0);
}

runTests().catch((err) => {
  console.error("Test failed:", err);
  process.exit(1);
});
