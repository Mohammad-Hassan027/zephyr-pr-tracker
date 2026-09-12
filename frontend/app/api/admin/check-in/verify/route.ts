import { NextRequest } from "next/server";
import {
  ADMIN_SESSION_COOKIE,
  PR_SESSION_COOKIE,
  getSessionToken,
  proxyBackendRequest,
  unauthorized,
} from "@/lib/server-auth";

export async function POST(request: NextRequest) {
  const token =
    (await getSessionToken(ADMIN_SESSION_COOKIE)) ||
    (await getSessionToken(PR_SESSION_COOKIE));

  if (!token) {
    return unauthorized();
  }

  const body = await request.text();
  return proxyBackendRequest("/registrations/check-in/verify", token, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body,
  });
}