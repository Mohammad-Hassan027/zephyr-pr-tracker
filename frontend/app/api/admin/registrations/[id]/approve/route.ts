import {
  ADMIN_SESSION_COOKIE,
  getSessionToken,
  proxyBackendRequest,
} from "@/lib/server-auth";

export async function PATCH(
  _req: Request,
  { params }: { params: { id: string } },
) {
  return proxyBackendRequest(
    `/registrations/${encodeURIComponent(params.id)}/approve`,
    getSessionToken(ADMIN_SESSION_COOKIE),
    { method: "PATCH" },
  );
}
