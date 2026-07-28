import { NextRequest } from "next/server";
import {
  getSessionToken,
  PR_SESSION_COOKIE,
  proxyBackendRequest,
} from "@/lib/server-auth";

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const body = await req.text();
  return proxyBackendRequest(
    `/registrations/${encodeURIComponent(params.id)}/reject`,
    getSessionToken(PR_SESSION_COOKIE),
    {
      method: "PATCH",
      headers: { "Content-Type": req.headers.get("content-type") || "application/json" },
      body,
    },
  );
}
