import { NextRequest } from "next/server";
import {
  getSessionToken,
  PR_SESSION_COOKIE,
  proxyBackendRequest,
} from "@/lib/server-auth";

export async function GET(request: NextRequest) {
  const search = request.nextUrl.search;
  return proxyBackendRequest(
    `/registrations/queue/pending${search}`,
    getSessionToken(PR_SESSION_COOKIE),
  );
}
