import {
  ADMIN_SESSION_COOKIE,
  getSessionToken,
  proxyBackendRequest,
} from "@/lib/server-auth";

export async function GET() {
  return proxyBackendRequest(
    "/registrations/stats/leaderboard",
    await getSessionToken(ADMIN_SESSION_COOKIE),
  );
}
