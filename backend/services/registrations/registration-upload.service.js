import cloudinary from "../../config/cloudinary.js";
import { CLOUDINARY_UPLOAD_FOLDER } from "../../validators/registration.validators.js";
import { AppError } from "../../utils/errors.js";

export const registrationUploadService = {
  async generateUploadSignature() {
    const { api_key: apiKey, api_secret: apiSecret, cloud_name: cloudName } =
      cloudinary.config();

    if (!apiKey || !apiSecret || !cloudName) {
      throw new AppError("Cloudinary upload is not configured", 500);
    }

    const timestamp = Math.round(Date.now() / 1000);
    const paramsToSign = {
      folder: CLOUDINARY_UPLOAD_FOLDER,
      timestamp,
    };
    const signature = cloudinary.utils.api_sign_request(paramsToSign, apiSecret);

    return {
      timestamp,
      signature,
      api_key: apiKey,
      cloud_name: cloudName,
      folder: CLOUDINARY_UPLOAD_FOLDER,
    };
  },
};

export default registrationUploadService;
