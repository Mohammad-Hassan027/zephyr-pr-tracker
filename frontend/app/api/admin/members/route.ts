import { NextRequest } from "next/server";
import {
  ADMIN_SESSION_COOKIE,
  getSessionToken,
  proxyBackendRequest,
} from "@/lib/server-auth";

export async function GET() {
  return proxyBackendRequest("/members", getSessionToken(ADMIN_SESSION_COOKIE));
}

export async function POST(req: NextRequest) {
  const body = await req.text();
  return proxyBackendRequest("/members", getSessionToken(ADMIN_SESSION_COOKIE), {
    method: "POST",
    headers: { "Content-Type": req.headers.get("content-type") || "application/json" },
    body,
  });
}
