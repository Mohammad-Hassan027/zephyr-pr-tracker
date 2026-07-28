import {
  ADMIN_SESSION_COOKIE,
  getSessionToken,
  proxyBackendRequest,
} from "@/lib/server-auth";

export async function GET() {
  return proxyBackendRequest(
    "/registrations/stats/summary",
    getSessionToken(ADMIN_SESSION_COOKIE),
  );
}
