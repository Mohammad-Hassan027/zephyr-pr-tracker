import { apiFetch, readJsonResponse } from "./client";
import type {
  CheckDuplicateParams,
  CloudinaryUploadResponse,
  LookupParams,
  LookupResult,
  RegistrationStatus,
  SubmitRegistrationForm,
  UploadSignature,
} from "./types";

export type {
  CheckDuplicateParams,
  CloudinaryUploadResponse,
  LookupParams,
  LookupResult,
  RegistrationStatus,
  SubmitRegistrationForm,
  UploadSignature,
};

export async function uploadPaymentScreenshot(file: File): Promise<{
  paymentScreenshot: string;
  paymentScreenshotPublicId: string;
}> {
  const signatureData = await apiFetch<UploadSignature & { error?: string }>(
    "/registrations/upload-signature",
    { method: "GET", cache: "no-store" }
  );

  const uploadBody = new FormData();
  uploadBody.append("file", file);
  uploadBody.append("api_key", signatureData.api_key);
  uploadBody.append("timestamp", String(signatureData.timestamp));
  uploadBody.append("signature", signatureData.signature);
  uploadBody.append("folder", signatureData.folder);

  const uploadRes = await fetch(
    `https://api.cloudinary.com/v1_1/${signatureData.cloud_name}/image/upload`,
    { method: "POST", body: uploadBody }
  );
  const uploadData = await readJsonResponse<CloudinaryUploadResponse>(uploadRes);

  if (!uploadRes.ok || !uploadData.secure_url || !uploadData.public_id) {
    throw new Error(
      uploadData.error?.message || "Payment screenshot upload failed"
    );
  }

  return {
    paymentScreenshot: uploadData.secure_url,
    paymentScreenshotPublicId: uploadData.public_id,
  };
}

export async function submitRegistration(
  form: SubmitRegistrationForm
): Promise<{ id: string; status: string }> {
  return apiFetch<{ id: string; status: string }>("/registrations", {
    method: "POST",
    body: form,
  });
}

export async function getRegistrationStatus(
  id: string
): Promise<RegistrationStatus> {
  try {
    return await apiFetch<RegistrationStatus>(`/registrations/${id}`, {
      cache: "no-store",
    });
  } catch {
    throw new Error("Registration not found");
  }
}

export async function checkDuplicateRegistration(
  params: CheckDuplicateParams
): Promise<{ exists: boolean; registrationId?: string; status?: string }> {
  return apiFetch<{ exists: boolean; registrationId?: string; status?: string }>(
    "/registrations/check-duplicate",
    {
      method: "POST",
      body: params,
    }
  );
}

export async function lookupRegistrations(
  params: LookupParams
): Promise<{ registrations: LookupResult[] }> {
  return apiFetch<{ registrations: LookupResult[] }>("/registrations/lookup", {
    method: "POST",
    body: params,
  });
}
