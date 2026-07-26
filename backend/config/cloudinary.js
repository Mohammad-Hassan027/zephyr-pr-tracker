import { v2 as cloudinary } from "cloudinary";

const CLOUD_NAME = process.env.CLOUDINARY_CLOUD_NAME;
const API_KEY = process.env.CLOUDINARY_API_KEY;
const API_SECRET = process.env.CLOUDINARY_API_SECRET;

if (!CLOUD_NAME || !API_KEY || !API_SECRET) {
  // Log the presence/absence of each var (avoid printing secrets)
  console.error("Cloudinary config missing:", {
    CLOUDINARY_CLOUD_NAME: !!CLOUD_NAME,
    CLOUDINARY_API_KEY: !!API_KEY,
    CLOUDINARY_API_SECRET: !!API_SECRET,
  });
  throw new Error(
    "Missing Cloudinary configuration. Ensure CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET are set.",
  );
}

cloudinary.config({
  cloud_name: CLOUD_NAME,
  api_key: API_KEY,
  api_secret: API_SECRET,
});

// Uploads an in-memory buffer (from multer) to Cloudinary and resolves with the result.
export function uploadBuffer(buffer, folder = "zephyr-payments") {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { folder, resource_type: "image" },
      (error, result) => {
        if (error) return reject(error);
        resolve(result);
      },
    );
    stream.end(buffer);
  });
}

export default cloudinary;
