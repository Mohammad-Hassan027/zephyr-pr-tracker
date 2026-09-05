import { apiFetch, readJsonResponse } from "./client";
import { resolveRegistrationToken } from "../registration-token";
import type {
  CheckDuplicateParams,
  CheckDuplicateResult,
  CloudinaryUploadResponse,
  LookupParams,
  LookupResult,
  RegistrationStatus,
  ResubmitRegistrationForm,
  SubmitRegistrationForm,
  SubmitRegistrationResponse,
  UploadSignature,
} from "./types";

export type {
  CheckDuplicateParams,
  CheckDuplicateResult,
  CloudinaryUploadResponse,
  LookupParams,
  LookupResult,
  RegistrationStatus,
  ResubmitRegistrationForm,
  SubmitRegistrationForm,
  SubmitRegistrationResponse,
  UploadSignature,
};

export async function uploadPaymentScreenshot(file: File): Promise<{
  paymentScreenshot: string;
  paymentScreenshotPublicId: string;
}> {
  const signatureData = await apiFetch<UploadSignature & { error?: string }>(
    "/registrations/upload-signature",
    { method: "GET", cache: "no-store" },
  );

  const uploadBody = new FormData();
  uploadBody.append("file", file);
  uploadBody.append("api_key", signatureData.api_key);
  uploadBody.append("timestamp", String(signatureData.timestamp));
  uploadBody.append("signature", signatureData.signature);
  uploadBody.append("folder", signatureData.folder);
  uploadBody.append("upload_preset", signatureData.upload_preset);
  uploadBody.append("resource_type", signatureData.resource_type);
  uploadBody.append("allowed_formats", signatureData.allowed_formats.join(","));
  uploadBody.append("max_file_size", String(signatureData.max_file_size));

  const uploadRes = await fetch(
    `https://api.cloudinary.com/v1_1/${signatureData.cloud_name}/image/upload`,
    { method: "POST", body: uploadBody },
  );
  const uploadData =
    await readJsonResponse<CloudinaryUploadResponse>(uploadRes);

  if (!uploadRes.ok || !uploadData.secure_url || !uploadData.public_id) {
    throw new Error(
      uploadData.error?.message || "Payment screenshot upload failed",
    );
  }

  return {
    paymentScreenshot: uploadData.secure_url,
    paymentScreenshotPublicId: uploadData.public_id,
  };
}

export async function submitRegistration(
  form: SubmitRegistrationForm,
): Promise<SubmitRegistrationResponse> {
  return apiFetch<SubmitRegistrationResponse>("/registrations", {
    method: "POST",
    body: form,
  });
}

export async function resubmitRegistration(
  id: string,
  form: ResubmitRegistrationForm,
  accessToken?: string,
): Promise<{ ok: boolean; message: string; data: RegistrationStatus }> {
  const token = accessToken || resolveRegistrationToken(id);
  const headers: Record<string, string> = {};
  if (token) {
    headers["x-registration-token"] = token;
  }
  return apiFetch<{ ok: boolean; message: string; data: RegistrationStatus }>(
    `/registrations/${id}/resubmit`,
    {
      method: "POST",
      body: form,
      headers,
    },
  );
}

export async function getRegistrationStatus(
  id: string,
  accessToken?: string,
): Promise<RegistrationStatus> {
  try {
    const token = accessToken || resolveRegistrationToken(id);
    const headers: Record<string, string> = {};
    if (token) {
      headers["x-registration-token"] = token;
    }
    return await apiFetch<RegistrationStatus>(`/registrations/${id}`, {
      cache: "no-store",
      headers,
    });
  } catch {
    throw new Error("Registration not found");
  }
}

export async function checkDuplicateRegistration(
  params: CheckDuplicateParams,
): Promise<CheckDuplicateResult> {
  return apiFetch<CheckDuplicateResult>("/registrations/check-duplicate", {
    method: "POST",
    body: params,
  });
}

export async function lookupRegistrations(
  params: LookupParams,
): Promise<{ registrations: LookupResult[] }> {
  const headers: Record<string, string> = {};
  if (params.accessToken) {
    headers["x-registration-token"] = params.accessToken;
  }
  return apiFetch<{ registrations: LookupResult[] }>("/registrations/lookup", {
    method: "POST",
    body: {
      studentEmail: params.studentEmail,
      clubSlug: params.clubSlug,
    },
    headers,
  });
}
