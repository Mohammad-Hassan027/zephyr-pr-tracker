import { NextRequest } from "next/server";
import {
  PR_SESSION_COOKIE,
  getSessionToken,
  proxyBackendRequest,
} from "@/lib/server-auth";

export async function GET(request: NextRequest) {
  const search = request.nextUrl.search;
  return proxyBackendRequest(
    `/registrations/export${search}`,
    await getSessionToken(PR_SESSION_COOKIE),
  );
}
