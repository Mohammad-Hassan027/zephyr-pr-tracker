import {
  getSessionToken,
  PR_SESSION_COOKIE,
  proxyBackendRequest,
} from "@/lib/server-auth";

export async function PATCH(
  _req: Request,
  { params }: { params: { id: string } },
) {
  return proxyBackendRequest(
    `/registrations/${encodeURIComponent(params.id)}/approve`,
    getSessionToken(PR_SESSION_COOKIE),
    { method: "PATCH" },
  );
}
