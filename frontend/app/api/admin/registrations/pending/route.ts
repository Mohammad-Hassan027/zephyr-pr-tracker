import { NextRequest } from "next/server";
import {
  ADMIN_SESSION_COOKIE,
  getSessionToken,
  proxyBackendRequest,
} from "@/lib/server-auth";

export async function GET(request: NextRequest) {
  const search = request.nextUrl.search;
  return proxyBackendRequest(
    `/registrations/queue/pending${search}`,
    getSessionToken(ADMIN_SESSION_COOKIE),
  );
}
