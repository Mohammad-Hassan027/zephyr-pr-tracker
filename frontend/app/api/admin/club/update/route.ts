import { NextRequest } from "next/server";
import {
  ADMIN_SESSION_COOKIE,
  getSessionToken,
  proxyBackendRequest,
} from "@/lib/server-auth";

export async function PATCH(req: NextRequest) {
  const token = await getSessionToken(ADMIN_SESSION_COOKIE);
  const body = await req.text();
  return proxyBackendRequest("/clubs/me", token, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body,
  });
}
