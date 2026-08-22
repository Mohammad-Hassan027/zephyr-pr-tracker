import { NextRequest } from "next/server";
import {
  getSessionToken,
  PR_SESSION_COOKIE,
  proxyBackendRequest,
} from "@/lib/server-auth";

export async function POST(req: NextRequest) {
  const token = await getSessionToken(PR_SESSION_COOKIE);
  const body = await req.text();

  return proxyBackendRequest("/registrations/bulk-reject", token, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body,
  });
}
