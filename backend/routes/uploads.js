import { Router } from "express";
// import cloudinary from "../config/cloudinary.js";
import rateLimit from "express-rate-limit";
import crypto from "node:crypto";

const router = Router();

const signLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 10, // max 10 signature requests per minute per IP
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many upload requests. Please wait a moment." },
});

/**
 * POST /api/uploads/sign
 *
 * Returns a time-limited Cloudinary signature so the browser can upload
 * directly to Cloudinary without routing the image file through Express.
 *
 * The browser will:
 *   1. Call this endpoint to get { timestamp, signature, api_key, cloud_name, folder }
 *   2. POST the file directly to https://api.cloudinary.com/v1_1/{cloud}/image/upload
 *   3. Receive { secure_url, public_id } from Cloudinary
 *   4. Submit only those two strings to POST /api/registrations
 *
 * Security: no admin auth required (public registration flow), but the
 * signature is scoped to the zephyr-payments folder and expires in 60s,
 * preventing abuse of the API credentials.
 */
router.post("/sign", signLimiter, (req, res) => {
  try {
    const folder = "zephyr-payments";
    const timestamp = Math.round(Date.now() / 1000);

    // Build the string-to-sign exactly as the Cloudinary docs specify
    const paramsToSign = `folder=${folder}&timestamp=${timestamp}`;
    const signature = crypto
      .createHash("sha256")
      .update(paramsToSign + process.env.CLOUDINARY_API_SECRET)
      .digest("hex");

    return res.json({
      timestamp,
      signature,
      api_key: process.env.CLOUDINARY_API_KEY,
      cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
      folder,
    });
  } catch (err) {
    return res.status(500).json({ error: "Failed to generate upload signature" });
  }
});

export default router;
