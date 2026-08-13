import { cookies } from "next/headers";
import { getSessionToken, proxyBackendRequest } from "@/lib/server-auth";

const PLATFORM_SESSION_COOKIE = "platform_admin_session";

export async function GET() {
  const token = cookies().get(PLATFORM_SESSION_COOKIE)?.value;
  return proxyBackendRequest("/clubs/pending", token);
}
