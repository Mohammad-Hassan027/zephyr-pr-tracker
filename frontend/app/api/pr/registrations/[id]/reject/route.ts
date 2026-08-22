import { NextRequest } from "next/server";
import {
  getSessionToken,
  PR_SESSION_COOKIE,
  proxyBackendRequest,
} from "@/lib/server-auth";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const body = await req.text();
  return proxyBackendRequest(
    `/registrations/${encodeURIComponent(id)}/reject`,
    await getSessionToken(PR_SESSION_COOKIE),
    {
      method: "PATCH",
      headers: { "Content-Type": req.headers.get("content-type") || "application/json" },
      body,
    },
  );
}
