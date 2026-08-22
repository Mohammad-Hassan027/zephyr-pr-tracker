import {
  getSessionToken,
  PR_SESSION_COOKIE,
  proxyBackendRequest,
} from "@/lib/server-auth";

export async function PATCH(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  return proxyBackendRequest(
    `/registrations/${encodeURIComponent(id)}/approve`,
    await getSessionToken(PR_SESSION_COOKIE),
    { method: "PATCH" },
  );
}
