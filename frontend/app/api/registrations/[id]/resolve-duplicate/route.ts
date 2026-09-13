import {
  ADMIN_SESSION_COOKIE,
  PR_SESSION_COOKIE,
  getSessionToken,
  proxyBackendRequest,
} from "@/lib/server-auth";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const adminToken = await getSessionToken(ADMIN_SESSION_COOKIE);
  const prToken = await getSessionToken(PR_SESSION_COOKIE);
  const token = adminToken || prToken;

  const body = await req.json().catch(() => ({}));
  return proxyBackendRequest(
    `/registrations/${encodeURIComponent(id)}/resolve-duplicate`,
    token,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    },
  );
}
