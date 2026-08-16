import { NextRequest } from "next/server";
import { cookies } from "next/headers";
import { proxyBackendRequest } from "@/lib/server-auth";

const PLATFORM_SESSION_COOKIE = "platform_admin_session";

export async function GET(req: NextRequest) {
  const token = cookies().get(PLATFORM_SESSION_COOKIE)?.value;
  const search = req.nextUrl.search;
  return proxyBackendRequest(`/clubs/platform/all${search}`, token);
}
