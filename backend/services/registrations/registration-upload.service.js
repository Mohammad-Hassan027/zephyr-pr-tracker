import cloudinary, { isCloudinaryConfigured } from "../../config/cloudinary.js";
import {
  CLOUDINARY_ALLOWED_FORMATS,
  CLOUDINARY_MAX_FILE_SIZE,
  CLOUDINARY_UPLOAD_FOLDER,
} from "../../validators/registration.validators.js";
import { AppError } from "../../utils/errors.js";

export const registrationUploadService = {
  async generateUploadSignature() {
    const {
      api_key: apiKey,
      api_secret: apiSecret,
      cloud_name: cloudName,
    } = cloudinary.config();
    const uploadPreset = process.env.CLOUDINARY_UPLOAD_PRESET;

    if (!apiKey || !apiSecret || !cloudName || !uploadPreset) {
      throw new AppError("Cloudinary upload is not configured", 500);
    }

    const timestamp = Math.round(Date.now() / 1000);
    const paramsToSign = {
      folder: CLOUDINARY_UPLOAD_FOLDER,
      timestamp,
      upload_preset: uploadPreset,
      resource_type: "image",
    };
    const signature = cloudinary.utils.api_sign_request(
      paramsToSign,
      apiSecret,
    );

    return {
      timestamp,
      signature,
      api_key: apiKey,
      cloud_name: cloudName,
      folder: CLOUDINARY_UPLOAD_FOLDER,
      upload_preset: uploadPreset,
      resource_type: "image",
      allowed_formats: CLOUDINARY_ALLOWED_FORMATS,
      max_file_size: CLOUDINARY_MAX_FILE_SIZE,
    };
  },

  async verifyUploadedAsset({ publicId, secureUrl }) {
    if (!isCloudinaryConfigured()) {
      throw new AppError("Cloudinary upload is not configured", 500);
    }

    const asset = await cloudinary.api.resource(publicId, {
      resource_type: "image",
      type: "upload",
    });
    const format = String(asset.format || "").toLowerCase();
    const configuredCloud = cloudinary.config().cloud_name;

    if (
      asset.public_id !== publicId ||
      asset.resource_type !== "image" ||
      asset.type !== "upload" ||
      !CLOUDINARY_ALLOWED_FORMATS.includes(format) ||
      !Number.isInteger(asset.bytes) ||
      asset.bytes <= 0 ||
      asset.bytes > CLOUDINARY_MAX_FILE_SIZE ||
      !asset.secure_url ||
      asset.secure_url !== secureUrl
    ) {
      throw new AppError("Uploaded file failed server-side validation", 400);
    }

    if (!secureUrl.includes(`/${configuredCloud}/image/upload/`)) {
      throw new AppError(
        "Uploaded file belongs to an unexpected Cloudinary cloud",
        400,
      );
    }

    return asset;
  },
};

export default registrationUploadService;
