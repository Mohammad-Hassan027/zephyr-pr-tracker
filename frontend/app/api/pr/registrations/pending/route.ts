import {
  getSessionToken,
  PR_SESSION_COOKIE,
  proxyBackendRequest,
} from "@/lib/server-auth";

export async function GET() {
  return proxyBackendRequest(
    "/registrations/queue/pending",
    getSessionToken(PR_SESSION_COOKIE),
  );
}
