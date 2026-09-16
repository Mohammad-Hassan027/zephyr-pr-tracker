import { v2 as cloudinary } from "cloudinary";

const CLOUD_NAME = process.env.CLOUDINARY_CLOUD_NAME;
const API_KEY = process.env.CLOUDINARY_API_KEY;
const API_SECRET = process.env.CLOUDINARY_API_SECRET;

export const isCloudinaryConfigured = () => {
  const configured = Boolean(
    process.env.CLOUDINARY_CLOUD_NAME &&
      process.env.CLOUDINARY_API_KEY &&
      process.env.CLOUDINARY_API_SECRET
  );
  if (configured) {
    const current = cloudinary.config();
    if (!current.cloud_name) {
      cloudinary.config({
        cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
        api_key: process.env.CLOUDINARY_API_KEY,
        api_secret: process.env.CLOUDINARY_API_SECRET,
      });
    }
  }
  return configured;
};

if (!isCloudinaryConfigured()) {
  // Gracefully handle missing configuration without throwing uncaught top-level exceptions
  console.warn("Cloudinary configuration missing or incomplete. Cloudinary operations will be disabled or mocked.");
}

export default cloudinary;
