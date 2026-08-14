import mongoose from "mongoose";

const counterSchema = new mongoose.Schema(
  {
    _id: {
      type: String,
      required: true,
      description: "Identifier key for the sequence (e.g., 'regNo', 'REG', 'invoice')",
    },
    seq: {
      type: Number,
      default: 0,
      min: 0,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

const Counter = mongoose.models.Counter || mongoose.model("Counter", counterSchema);

/**
 * Atomically increments and returns the next sequence number for a given counter identifier.
 * Participates in an existing Mongoose/MongoDB transaction session if provided.
 *
 * @param {string} name - The sequence identifier (e.g., "regNo")
 * @param {mongoose.ClientSession|Object} [sessionOrOptions] - Optional Mongoose session or options object
 * @returns {Promise<number>} The newly incremented sequence number
 */
export async function nextSequence(name, sessionOrOptions = null) {
  if (!name || typeof name !== "string") {
    throw new Error("Counter sequence name must be a non-empty string");
  }

  let session = null;
  let step = 1;

  if (sessionOrOptions) {
    // Direct ClientSession instance
    if (
      sessionOrOptions.constructor?.name === "ClientSession" ||
      typeof sessionOrOptions.startTransaction === "function" ||
      sessionOrOptions.$session
    ) {
      session = sessionOrOptions;
    } else if (typeof sessionOrOptions === "object") {
      // Options object: { session, step }
      if (sessionOrOptions.session) {
        session = sessionOrOptions.session;
      }
      if (typeof sessionOrOptions.step === "number") {
        step = sessionOrOptions.step;
      }
    }
  }

  const queryOptions = {
    new: true, // Return modified document rather than original
    upsert: true, // Create counter doc if not present
    setDefaultsOnInsert: true,
  };

  if (session) {
    queryOptions.session = session;
  }

  const counter = await Counter.findByIdAndUpdate(
    name,
    { $inc: { seq: step } },
    queryOptions
  );

  return counter.seq;
}

/**
 * Helper to generate a formatted sequential identifier (e.g., "REG-0001" or "ZP0001").
 *
 * @param {string} name - Sequence identifier
 * @param {Object} [options]
 * @param {string} [options.prefix="REG-"] - Prefix string
 * @param {number} [options.padLength=4] - Minimum digits padding
 * @param {mongoose.ClientSession} [options.session] - Optional transaction session
 * @param {number} [options.step=1] - Increment step
 * @returns {Promise<string>} e.g. "REG-0001"
 */
export async function nextFormattedId(
  name,
  { prefix = "REG-", padLength = 4, session = null, step = 1 } = {}
) {
  const seq = await nextSequence(name, { session, step });
  return `${prefix}${String(seq).padStart(padLength, "0")}`;
}

export default Counter;
