import {
  ADMIN_SESSION_COOKIE,
  getSessionToken,
  proxyBackendRequest,
} from "@/lib/server-auth";

export async function GET() {
  return proxyBackendRequest(
    "/registrations/queue/pending",
    getSessionToken(ADMIN_SESSION_COOKIE),
  );
}
