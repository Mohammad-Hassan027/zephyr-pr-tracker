import {
  ADMIN_SESSION_COOKIE,
  getSessionToken,
  proxyBackendRequest,
} from "@/lib/server-auth";

export async function PATCH(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  return proxyBackendRequest(
    `/registrations/${encodeURIComponent(id)}/approve`,
    await getSessionToken(ADMIN_SESSION_COOKIE),
    { method: "PATCH" },
  );
}
