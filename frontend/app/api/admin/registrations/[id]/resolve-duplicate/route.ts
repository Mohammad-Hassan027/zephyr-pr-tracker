import {
  ADMIN_SESSION_COOKIE,
  getSessionToken,
  proxyBackendRequest,
} from "@/lib/server-auth";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  return proxyBackendRequest(
    `/registrations/${encodeURIComponent(id)}/resolve-duplicate`,
    await getSessionToken(ADMIN_SESSION_COOKIE),
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    },
  );
}
