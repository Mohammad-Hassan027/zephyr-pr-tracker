import { NextRequest } from "next/server";
import {
  getSessionToken,
  PR_SESSION_COOKIE,
  proxyBackendRequest,
} from "@/lib/server-auth";

export async function GET(req: NextRequest) {
  const token = getSessionToken(PR_SESSION_COOKIE);
  const search = req.nextUrl.search;

  return proxyBackendRequest(`/registrations/stats/member${search}`, token, {
    method: "GET",
  });
}
