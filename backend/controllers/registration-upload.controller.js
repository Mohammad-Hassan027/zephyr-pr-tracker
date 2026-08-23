import registrationUploadService from "../services/registrations/registration-upload.service.js";

export async function getUploadSignature(_req, res) {
  try {
    const signatureData = await registrationUploadService.generateUploadSignature();
    return res.json(signatureData);
  } catch (err) {
    return res
      .status(err.statusCode || 500)
      .json({ error: err.message || "Failed to generate upload signature" });
  }
}

export default { getUploadSignature };
