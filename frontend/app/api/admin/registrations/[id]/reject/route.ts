import { NextRequest } from "next/server";
import {
  ADMIN_SESSION_COOKIE,
  getSessionToken,
  proxyBackendRequest,
} from "@/lib/server-auth";

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const body = await req.text();
  return proxyBackendRequest(
    `/registrations/${encodeURIComponent(params.id)}/reject`,
    getSessionToken(ADMIN_SESSION_COOKIE),
    {
      method: "PATCH",
      headers: { "Content-Type": req.headers.get("content-type") || "application/json" },
      body,
    },
  );
}
