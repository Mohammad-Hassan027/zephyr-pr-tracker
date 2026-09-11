import mongoose from "mongoose";

/**
 * Checks if an error is a transient MongoDB/Mongoose transaction error that can be safely retried.
 *
 * @param {Error|any} error - The caught error
 * @returns {boolean} True if transient/retryable
 */
export function isTransientError(error) {
  if (!error) return false;

  // MongoDB driver error labels
  if (typeof error.hasErrorLabel === "function") {
    if (
      error.hasErrorLabel("TransientTransactionError") ||
      error.hasErrorLabel("UnknownTransactionCommitResult")
    ) {
      return true;
    }
  }

  // MongoDB numeric error codes for concurrency conflicts and transient states
  // 112 = WriteConflict
  // 251 = NoSuchTransaction (e.g. session timeout or primary failover)
  // 24  = LockTimeout
  // 11600 = InterruptedAtShutdown
  // 11601 = Interrupted
  // 11602 = InterruptedDueToReplStateChange
  const transientErrorCodes = [112, 251, 24, 11600, 11601, 11602];
  if (transientErrorCodes.includes(error.code)) {
    return true;
  }

  if (error.codeName === "WriteConflict" || error.codeName === "LockTimeout") {
    return true;
  }

  // Fallback message inspection
  const msg = typeof error.message === "string" ? error.message.toLowerCase() : "";
  if (
    msg.includes("write conflict") ||
    msg.includes("transienttransactionerror") ||
    msg.includes("writeconflict") ||
    msg.includes("transaction has been aborted")
  ) {
    return true;
  }

  return false;
}

/**
 * Returns true when a MongoDB error indicates that the server does not support
 * multi-document transactions (i.e. it is a standalone instance rather than a
 * replica set or mongos).  These errors are *not* transient — retrying will
 * not help — so callers should fall back to sessionless execution instead.
 *
 * @param {Error|any} error
 * @returns {boolean}
 */
export function isReplicaSetRequiredError(error) {
  if (!error) return false;
  // MongoDB error code 20 = IllegalOperation
  if (error.code === 20) return true;
  const msg = typeof error.message === "string" ? error.message.toLowerCase() : "";
  return (
    msg.includes("transaction numbers are only allowed on a replica set") ||
    msg.includes("replica set") ||
    msg.includes("mongos")
  );
}

/**
 * Calculates exponential backoff with full jitter to avoid thundering herd contention.
 *
 * @param {number} attempt - 1-based attempt index
 * @param {number} initialDelayMs - Base delay
 * @param {number} maxDelayMs - Max delay limit
 * @param {number} backoffFactor - Multiplier
 * @param {boolean} jitter - Whether to apply randomization
 * @returns {number} Delay in milliseconds
 */
function calculateBackoff(attempt, initialDelayMs, maxDelayMs, backoffFactor, jitter) {
  const exponential = Math.min(
    maxDelayMs,
    initialDelayMs * Math.pow(backoffFactor, attempt - 1)
  );

  if (jitter) {
    const min = Math.floor(initialDelayMs / 2);
    return Math.floor(Math.random() * (exponential - min + 1)) + min;
  }

  return exponential;
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Process-level cache: once we detect a standalone server we stop attempting
// sessions so that subsequent calls skip the session overhead entirely.
let _replicaSetSupported = null; // null = unknown, true = supported, false = standalone

/**
 * Executes a callback within a Mongoose transaction, wrapping boilerplate and
 * automatically retrying transient errors (e.g., WriteConflict) with exponential backoff.
 *
 * When running against a standalone MongoDB instance (which does not support
 * multi-document transactions), the function detects the error on the first
 * attempt and falls back to executing the callback without a session.  This
 * makes local development work seamlessly without requiring a replica set while
 * preserving full transactional safety in production.
 *
 * @template T
 * @param {(session: mongoose.ClientSession|null) => Promise<T>} fn - Callback containing transaction operations
 * @param {Object} [options] - Configuration options
 * @param {number} [options.maxRetries=3] - Maximum retry attempts for transient errors
 * @param {number} [options.initialDelayMs=100] - Base delay before retrying
 * @param {number} [options.maxDelayMs=2000] - Maximum backoff delay
 * @param {number} [options.backoffFactor=2] - Exponential multiplier
 * @param {boolean} [options.jitter=true] - Apply jitter to backoff
 * @param {mongoose.Connection} [options.connection] - Mongoose connection instance
 * @param {Object} [options.transactionOptions] - Custom MongoDB transaction options
 * @param {Console|Object} [options.logger=console] - Logger instance
 * @returns {Promise<T>} Result of the transaction callback
 */
export async function withTransaction(fn, options = {}) {
  const {
    maxRetries = 3,
    initialDelayMs = 100,
    maxDelayMs = 2000,
    backoffFactor = 2,
    jitter = true,
    connection = mongoose.connection,
    transactionOptions = {
      readConcern: { level: "snapshot" },
      writeConcern: { w: "majority" },
      readPreference: "primary",
    },
    logger = console,
  } = options;

  // Fast path: we already know this server doesn't support transactions.
  if (_replicaSetSupported === false) {
    return fn(null);
  }

  let lastError;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    const session = await connection.startSession();

    try {
      session.startTransaction(transactionOptions);

      // Execute caller's transactional work
      const result = await fn(session);

      // Commit transaction atomically
      await session.commitTransaction();

      // Mark that transactions are supported (only needed once)
      _replicaSetSupported = true;

      return result;
    } catch (error) {
      lastError = error;

      // Ensure transaction is cleanly aborted if still in-flight
      if (session.inTransaction()) {
        try {
          await session.abortTransaction();
        } catch (abortError) {
          logger.warn?.(
            `[withTransaction] Non-critical warning during abort on attempt ${attempt}: ${abortError.message}`
          );
        }
      }

      // Standalone MongoDB fallback: transactions are not supported at all.
      // Cache the result so subsequent calls skip the session overhead.
      if (isReplicaSetRequiredError(error)) {
        _replicaSetSupported = false;
        logger.warn?.(
          "[withTransaction] MongoDB is not running as a replica set — transactions are not supported. " +
          "Falling back to sessionless execution. This is expected in local development. " +
          "In production, ensure MongoDB is configured as a replica set or use MongoDB Atlas."
        );
        await session.endSession();
        return fn(null);
      }

      const isTransient = isTransientError(error);

      // Retry only if the error is transient and retry budget remains
      if (isTransient && attempt < maxRetries) {
        const delay = calculateBackoff(
          attempt,
          initialDelayMs,
          maxDelayMs,
          backoffFactor,
          jitter
        );

        logger.warn?.(
          `[withTransaction] Transient error encountered on attempt ${attempt}/${maxRetries} (${error.codeName || error.code || "TransientError"}: ${error.message}). Retrying in ${delay}ms...`
        );

        await sleep(delay);
        continue;
      }

      // Re-throw non-transient errors (or exhausted retries) immediately
      throw error;
    } finally {
      // Release session resource
      await session.endSession();
    }
  }

  throw lastError;
}

export default withTransaction;
