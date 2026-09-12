import { NextRequest } from "next/server";
import {
  ADMIN_SESSION_COOKIE,
  PR_SESSION_COOKIE,
  getSessionToken,
  proxyBackendRequest,
  unauthorized,
} from "@/lib/server-auth";

export async function GET(request: NextRequest) {
  const token =
    (await getSessionToken(ADMIN_SESSION_COOKIE)) ||
    (await getSessionToken(PR_SESSION_COOKIE));

  if (!token) {
    return unauthorized();
  }

  const search = request.nextUrl.search;
  return proxyBackendRequest(`/registrations/check-in/lookup${search}`, token, {
    method: "GET",
  });
}