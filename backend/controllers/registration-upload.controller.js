import registrationUploadService from "../services/registrations/registration-upload.service.js";

export async function getUploadSignature(_req, res, next) {
  try {
    const signatureData = await registrationUploadService.generateUploadSignature();
    return res.json(signatureData);
  } catch (err) {
    return next(err);
  }
}

export default { getUploadSignature };
