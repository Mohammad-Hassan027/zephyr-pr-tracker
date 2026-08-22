import { cookies } from "next/headers";
import { NextRequest } from "next/server";
import { proxyBackendRequest } from "@/lib/server-auth";

const PLATFORM_SESSION_COOKIE = "platform_admin_session";

export async function PATCH(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const token = (await cookies()).get(PLATFORM_SESSION_COOKIE)?.value;
  return proxyBackendRequest(`/clubs/${id}/approve`, token, {
    method: "PATCH",
  });
}
