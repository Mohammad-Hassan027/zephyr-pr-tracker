import { cookies } from "next/headers";
import { NextRequest } from "next/server";
import { proxyBackendRequest } from "@/lib/server-auth";

const PLATFORM_SESSION_COOKIE = "platform_admin_session";

export async function PATCH(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const token = cookies().get(PLATFORM_SESSION_COOKIE)?.value;
  return proxyBackendRequest(`/clubs/${params.id}/approve`, token, {
    method: "PATCH",
  });
}
